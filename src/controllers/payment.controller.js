// src/controllers/payment.controller.js
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js"; // nếu muốn update current_guests
import { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } from "vnpay";

/** =========================
 *  1. Khởi tạo instance VNPay
 * ========================= */
const vnpay = new VNPay({
  tmnCode: process.env.VNP_TMN_CODE,            // từ .env
  secureSecret: process.env.VNP_HASH_SECRET,    // từ .env
  vnpayHost: process.env.VNP_HOST || "https://sandbox.vnpayment.vn",
  testMode: process.env.NODE_ENV !== "production",
  hashAlgorithm: process.env.VNP_HASH_ALGO || "SHA512",
  loggerFn: ignoreLogger,
});

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

/** Helper: lấy IP client */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
}

/** Helper: chọn số tiền cần thanh toán (đặt cọc hay full) */
function getBookingPayAmount(booking, payFull = false) {
  if (payFull || booking.requireFullPayment) {
    return Number(booking.totalPrice || 0);
  }
  // thanh toán tiền cọc
  return Number(booking.depositAmount || 0);
}

/* =====================================================
 *  A) TẠO URL THANH TOÁN VNPAY CHO 1 BOOKING
 *  POST /api/payment/vnpay
 *  Body: { code: "BKXXXX", payFull?: boolean }
 * ===================================================== */
export const createVNPayPayment = async (req, res) => {
  try {
    const { code, payFull = false } = req.body || {};
    const userId = req.user?.id;

    if (!code) {
      return res.status(400).json({ message: "Missing booking code" });
    }
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Chỉ cho phép thanh toán booking của chính user
    const booking = await Booking.findOne({ code, userId }).populate(
      "tourId",
      "title destination"
    );
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.bookingStatus === "c") {
      return res.status(400).json({ message: "Booking already completed" });
    }

    const amount = getBookingPayAmount(booking, payFull);
    if (amount <= 0) {
      return res
        .status(400)
        .json({ message: "Invalid amount to pay for this booking" });
    }

    // Build URL thanh toán
    const ipAddr = getClientIp(req);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const orderInfo = payFull
      ? `Thanh toan 100% booking ${booking.code}`
      : `Thanh toan tien coc booking ${booking.code}`;

    // vnpay.buildPaymentUrl sẽ tự add version, hash,...
    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: amount,                // THƯ VIỆN TỰ NHÂN *100
      vnp_IpAddr: ipAddr,
      vnp_TxnRef: booking.code,         // dùng code booking
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: ProductCode.Other,
      vnp_ReturnUrl: process.env.VNP_RETURN_URL || `${API_BASE_URL}/api/payment/vnpay/return`,
      vnp_Locale: VnpLocale.VN,
      vnp_CreateDate: dateFormat(now),
      vnp_ExpireDate: dateFormat(tomorrow),
    });

    // Lưu tạm thông tin lựa chọn (đặt cọc hay full) nếu muốn
    booking.paymentMethod = "vnpay";
    await booking.save();

    return res.status(201).json({
      message: "Tạo URL thanh toán VNPay thành công",
      paymentUrl,
      bookingCode: booking.code,
      amount,
      payFull: !!payFull,
    });
  } catch (err) {
    console.error("createVNPayPayment error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
 *  B) CALLBACK / RETURN URL TỪ VNPAY
 *  GET /api/payment/vnpay/return
 *  VNPay redirect user về URL này sau khi thanh toán
 * ===================================================== */
export const vnpayReturn = async (req, res) => {
  try {
    const { vnp_ResponseCode, vnp_TxnRef, vnp_Amount } = req.query;

    // TODO: Có thể verify chữ ký bằng thư viện/thuật toán riêng nếu muốn
    // (thư viện vnpay hiện tại chủ yếu build URL, không verify sẵn)

    if (!vnp_TxnRef) {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=missing_txnref`
      );
    }

    const booking = await Booking.findOne({ code: vnp_TxnRef });
    if (!booking) {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=booking_not_found`
      );
    }

    // Không thành công
    if (vnp_ResponseCode !== "00") {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=${vnp_ResponseCode}&code=${booking.code}`
      );
    }

    // Thành công: cập nhật thanh toán
    const amountPaid = Number(vnp_Amount || 0) / 100;

    // Idempotent: nếu đã có paymentRefs vnpay với cùng ref thì thôi
    const ref = req.query.vnp_TransactionNo || Date.now().toString();
    if (
      booking.paymentRefs?.some(
        (p) => p.provider === "vnpay" && p.ref === String(ref)
      )
    ) {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=success&code=${booking.code}`
      );
    }

    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "vnpay",
      ref: String(ref),
      amount: amountPaid,
      at: new Date(),
    });

    const wasDeposited = Boolean(booking.depositPaid);
    const isFirstDeposit = !wasDeposited && amountPaid > 0;

    booking.paidAmount = (booking.paidAmount || 0) + amountPaid;
    if (isFirstDeposit) booking.depositPaid = true;

    if (booking.paidAmount >= booking.totalPrice) {
      booking.bookingStatus = "c"; // completed
    }
    await booking.save();

    // Nếu là lần cọc đầu tiên, cập nhật current_guests + trạng thái tour
    if (isFirstDeposit) {
      const guestsToAdd =
        (booking.numAdults || 0) + (booking.numChildren || 0);

      if (mongoose.isValidObjectId(booking.tourId)) {
        const tour = await Tour.findById(booking.tourId);
        if (tour) {
          const before = tour.current_guests || 0;
          const after = before + guestsToAdd;

          tour.current_guests = after;

          // nếu đã đủ min_guests thì xác nhận tour
          if (
            (tour.min_guests || 0) > 0 &&
            after >= (tour.min_guests || 0) &&
            tour.status !== "confirmed"
          ) {
            tour.status = "confirmed";
          }
          await tour.save();
        }
      }
    }

    return res.redirect(
      `${FRONTEND_URL}/payment?status=success&code=${booking.code}`
    );
  } catch (err) {
    console.error("vnpayReturn error:", err);
    return res.redirect(
      `${FRONTEND_URL}/payment?status=failed&reason=server_error`
    );
  }
};

/* =====================================================
 *  (TUỲ CHỌN) IPN TỪ VNPAY
 *  GET /api/payment/vnpay/ipn
 *  (nếu bạn đăng ký IPN URL với VNPay)
 * ===================================================== */
export const vnpayIpn = async (req, res) => {
  try {
    const { vnp_ResponseCode, vnp_TxnRef, vnp_Amount } = req.query;

    if (!vnp_TxnRef) {
      return res.json({ RspCode: "99", Message: "Missing TxnRef" });
    }

    const booking = await Booking.findOne({ code: vnp_TxnRef });
    if (!booking) {
      return res.json({ RspCode: "01", Message: "Booking not found" });
    }

    if (vnp_ResponseCode !== "00") {
      return res.json({
        RspCode: "00",
        Message: "Payment failed (but acknowledged)",
      });
    }

    const amountPaid = Number(vnp_Amount || 0) / 100;
    const ref = req.query.vnp_TransactionNo || Date.now().toString();

    // Idempotent
    if (
      booking.paymentRefs?.some(
        (p) => p.provider === "vnpay" && p.ref === String(ref)
      )
    ) {
      return res.json({ RspCode: "00", Message: "Already confirmed" });
    }

    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "vnpay",
      ref: String(ref),
      amount: amountPaid,
      at: new Date(),
    });

    const wasDeposited = Boolean(booking.depositPaid);
    const isFirstDeposit = !wasDeposited && amountPaid > 0;

    booking.paidAmount = (booking.paidAmount || 0) + amountPaid;
    if (isFirstDeposit) booking.depositPaid = true;

    if (booking.paidAmount >= booking.totalPrice) {
      booking.bookingStatus = "c";
    }
    await booking.save();

    // Có thể copy y chang logic update tour như ở vnpayReturn
    return res.json({ RspCode: "00", Message: "Confirm success" });
  } catch (err) {
    console.error("vnpayIpn error:", err);
    return res.json({ RspCode: "99", Message: "Unknown error" });
  }
};
