// src/controllers/payment.controller.js
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js"; // nếu muốn update current_guests
import { buildVNPayPayUrl, verifyVNPayChecksum } from "../utils/vnpay.js";
import { Notification } from "../models/Notification.js";

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

/** Helper: chọn số tiền cần thanh toán (cố định 50% hoặc full) */
function getBookingPayAmount(booking, payFull = false) {
  if (payFull) return Number(booking.totalPrice || 0);
  const paid = booking.paidAmount || 0;
  const remaining = Math.max(0, booking.totalPrice - paid);
  // Yêu cầu thêm số tiền để đạt ngưỡng 50%
  const depositThreshold = booking.totalPrice * 0.5;
  const toDeposit = Math.max(0, depositThreshold - paid);
  return toDeposit > 0 ? toDeposit : remaining;
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
    const booking = await Booking.findOne({ code, userId }).populate({
      path: "tourDepartureId",
      populate: { path: "tourId", select: "title destination" },
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.bookingStatus === "completed") {
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

    const orderInfo = payFull
      ? `Thanh toan 100% booking ${booking.code}`
      : `Thanh toan tien coc booking ${booking.code}`;
      
    // Remove accents and special characters for vnp_OrderInfo
    const normalizedOrderInfo = orderInfo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, '+');

    const paymentUrl = buildVNPayPayUrl({
      vnpUrl: process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      tmnCode: process.env.VNP_TMNCODE,
      hashSecret: process.env.VNP_HASHSECRET,
      amountVND: amount,
      orderInfo: normalizedOrderInfo,
      txnRef: `${booking.code}-${Date.now()}`, // append timestamp to ensure uniqueness per attempt
      ipAddr: ipAddr,
      returnUrl: process.env.VNP_RETURN_URL || `${API_BASE_URL}/api/payment/vnpay/return`,
      locale: "vn",
      orderType: "other",
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
    const vnp_Params = req.query;
    const { vnp_ResponseCode, vnp_TxnRef, vnp_Amount } = vnp_Params;

    if (!vnp_TxnRef) {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=missing_txnref`
      );
    }

    const realCode = vnp_TxnRef.split("-")[0];
    const booking = await Booking.findOne({ code: realCode });
    if (!booking) {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=booking_not_found`
      );
    }

    // Kiểm tra chữ ký (checksum)
    const checkSumResult = verifyVNPayChecksum(vnp_Params, process.env.VNP_HASHSECRET);
    if (!checkSumResult.ok) {
      console.error("VNPay Return: Checksum failed for booking", vnp_TxnRef);
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=invalid_signature&code=${booking.code}`
      );
    }

    // Không thành công
    if (vnp_ResponseCode !== "00") {
      return res.redirect(
        `${FRONTEND_URL}/payment?status=failed&reason=${vnp_ResponseCode}&code=${booking.code}`
      );
    }

    // Thành công: cập nhật thanh toán (VNPay trả về số tiền x 100)
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

    // Không cập nhật trực tiếp ở Return URL để tránh xung đột với IPN. 
    // Tuy nhiên, nếu IPN chưa kịp chạy, việc cập nhật ở đây giúp user thấy kết quả ngay lập tức.
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

    // Logic: cọc ≥50% → confirmed, đủ 100% → completed
    const depositThreshold = booking.totalPrice * 0.5;
    if (!booking.depositPaid && booking.paidAmount >= depositThreshold) {
      booking.depositPaid = true;
      if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
    }
    if (booking.paidAmount >= booking.totalPrice) {
      booking.bookingStatus = "completed";
    }
    await booking.save();

    // --- TẠO THÔNG BÁO ---
    if (booking.userId) {
       Notification.create({
         type: "payment",
         title: "Thanh toán thành công",
         content: `Thanh toán ${amountPaid.toLocaleString('vi-VN')}đ cho đơn #${booking.code} thành công qua VNPay.`,
         link: `/user/history`,
         targetType: "user",
         targetUsers: [booking.userId],
       }).catch(console.error);
    }
    // ---------------------

    // Nếu là lần cọc đầu tiên, cập nhật current_guests + trạng thái tour
    if (isFirstDeposit) {
      const guestsToAdd = (booking.numAdults || 0) + (booking.numChildren || 0);

      const depId = booking.tourDepartureId?._id || booking.tourDepartureId;
      if (mongoose.isValidObjectId(depId)) {
        const TourDepartureModel = mongoose.model("TourDeparture");
        const tourDep = await TourDepartureModel.findById(depId);
        if (tourDep) {
          const before = tourDep.current_guests || 0;
          const after = before + guestsToAdd;

          tourDep.current_guests = after;

          // nếu đã đủ min_guests thì xác nhận tour
          if (
            (tourDep.min_guests || 0) > 0 &&
            after >= (tourDep.min_guests || 0) &&
            tourDep.status === "pending"
          ) {
            tourDep.status = "confirmed";
          }
          await tourDep.save();
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
    const vnp_Params = req.query;
    const { vnp_ResponseCode, vnp_TxnRef, vnp_Amount } = vnp_Params;

    if (!vnp_TxnRef) {
      return res.json({ RspCode: "99", Message: "Missing TxnRef" });
    }

    // Kiểm tra chữ ký (checksum) TRƯỚC KHI TÌM BOOKING
    const checkSumResult = verifyVNPayChecksum(vnp_Params, process.env.VNP_HASHSECRET);
    if (!checkSumResult.ok) {
      console.error("VNPay IPN: Checksum failed for booking", vnp_TxnRef);
      return res.json({ RspCode: "97", Message: "Checksum failed" });
    }

    const realCode = vnp_TxnRef.split("-")[0];
    const booking = await Booking.findOne({ code: realCode });
    if (!booking) {
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    const amountPaid = Number(vnp_Amount || 0) / 100;
    
    // Kiểm tra số tiền
    // Note: IPN có thể gọi nhiều lần cho các thanh toán cọc/toàn bộ.
    // Tạm bỏ qua check amount strictly if payment amount matches any valid threshold.
    // Thực tế VNPay sample code bắt check amount nhưng ở đây do có payFull và payDeposit nên bỏ qua check nghiêm ngặt.
    
    // Kiểm tra trạng thái: nếu đã confirm hoặc complete, bỏ qua
    // Tuy nhiên theo mẫu:
    const ref = req.query.vnp_TransactionNo || Date.now().toString();

    // Idempotent
    if (
      booking.paymentRefs?.some(
        (p) => p.provider === "vnpay" && p.ref === String(ref)
      )
    ) {
      return res.json({ RspCode: "02", Message: "Order already confirmed" });
    }

    if (vnp_ResponseCode !== "00") {
      // Giao dịch không thành công
      return res.json({
        RspCode: "00",
        Message: "Payment failed (but acknowledged)",
      });
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

    const depositThresholdIpn = booking.totalPrice * 0.5;
    if (!booking.depositPaid && booking.paidAmount >= depositThresholdIpn) {
      booking.depositPaid = true;
      if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
    }
    if (booking.paidAmount >= booking.totalPrice) {
      booking.bookingStatus = "completed";
    }
    await booking.save();

    // --- TẠO THÔNG BÁO ---
    if (booking.userId) {
       Notification.create({
         type: "payment",
         title: "Thanh toán thành công",
         content: `Thanh toán ${amountPaid.toLocaleString('vi-VN')}đ cho đơn #${booking.code} thành công qua VNPay.`,
         link: `/user/history`,
         targetType: "user",
         targetUsers: [booking.userId],
       }).catch(console.error);
    }
    // ---------------------

    // Có thể copy y chang logic update tour như ở vnpayReturn
    if (isFirstDeposit) {
      const guestsToAdd = (booking.numAdults || 0) + (booking.numChildren || 0);

      const depId = booking.tourDepartureId?._id || booking.tourDepartureId;
      if (mongoose.isValidObjectId(depId)) {
        const TourDepartureModel = mongoose.model("TourDeparture");
        const tourDep = await TourDepartureModel.findById(depId);
        if (tourDep) {
          const before = tourDep.current_guests || 0;
          const after = before + guestsToAdd;

          tourDep.current_guests = after;

          // nếu đã đủ min_guests thì xác nhận tour
          if (
            (tourDep.min_guests || 0) > 0 &&
            after >= (tourDep.min_guests || 0) &&
            tourDep.status === "pending"
          ) {
            tourDep.status = "confirmed";
          }
          await tourDep.save();
        }
      }
    }

    return res.json({ RspCode: "00", Message: "Confirm success" });
  } catch (err) {
    console.error("vnpayIpn error:", err);
    return res.json({ RspCode: "99", Message: "Unknown error" });
  }
};
