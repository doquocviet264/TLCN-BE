import crypto from "crypto";
import { Booking } from "../models/Booking.js";

/**
 * Sepay payment integration
 * Sepay là dịch vụ tạo QR Code chuyển khoản ngân hàng tự động
 * Docs: https://docs.sepay.vn/
 */

// Config từ environment
const SEPAY_MERCHANT_ID = process.env.SEPAY_MERCHANT_ID || "";
const SEPAY_API_KEY = process.env.SEPAY_API_KEY || "";
const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || "VCB"; // Vietcombank default
const SEPAY_ACCOUNT_NO = process.env.SEPAY_ACCOUNT_NO || "";
const SEPAY_ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME || "";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Tạo URL QR thanh toán Sepay
 * POST /api/payment/sepay/create
 * body: { code: "BKXXX", amount: 1000000 }
 */
export const sepayCreate = async (req, res) => {
  try {
    console.log("=== sepayCreate incoming ===");
    console.log("body:", req.body);

    // Lấy mã booking và số tiền
    const code = req.body?.code ?? req.body?.bookingCode;
    const amount = req.body?.amount ?? req.body?.totalPrice;

    if (!code) return res.status(400).json({ message: "code is required" });
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: "amount must be a positive number" });

    // Tìm Booking
    const booking = await Booking.findOne({ code });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const totalPrice = booking.totalPrice || 0;
    const paid = booking.paidAmount || 0;
    const remain = Math.max(0, totalPrice - paid);
    if (remain <= 0)
      return res.status(400).json({ message: "No remaining amount to pay" });

    const payAmount = Math.min(Number(amount), remain);

    // Tạo mã giao dịch duy nhất
    const txnRef = `${booking.code}${Date.now()}`;

    // Nội dung chuyển khoản (cần ngắn gọn để không bị ngân hàng cắt)
    const transferContent = `${booking.code}`;

    // Tạo QR URL theo chuẩn VietQR hoặc Sepay
    // Format: https://qr.sepay.vn/img?acc={acc}&bank={bank}&amount={amount}&des={description}
    const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(
      SEPAY_ACCOUNT_NO
    )}&bank=${encodeURIComponent(SEPAY_BANK_CODE)}&amount=${payAmount}&des=${encodeURIComponent(
      transferContent
    )}`;

    // Tạo deeplink cho app ngân hàng (tùy chọn)
    const deeplink = `https://dl.vietqr.io/pay?app=vcb&ba=${SEPAY_ACCOUNT_NO}&am=${payAmount}&tn=${encodeURIComponent(
      transferContent
    )}`;

    // Tạo trang thanh toán với QR
    const payUrl = `${FRONTEND_URL}/user/checkout/sepay-qr?code=${booking.code}&amount=${payAmount}&qr=${encodeURIComponent(
      qrUrl
    )}&ref=${txnRef}`;

    // Lưu ref vào booking
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "sepay",
      ref: txnRef,
      amount: payAmount,
      at: new Date(),
      note: "pending_qr",
    });
    await booking.save();

    console.log("-> returning sepay payUrl", payUrl);
    return res.json({
      payUrl,
      qrUrl,
      deeplink,
      txnRef,
      remain,
      payAmount,
      transferContent,
      bankInfo: {
        bankCode: SEPAY_BANK_CODE,
        accountNo: SEPAY_ACCOUNT_NO,
        accountName: SEPAY_ACCOUNT_NAME,
      },
    });
  } catch (err) {
    console.error("sepayCreate error", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Webhook nhận thông báo từ Sepay khi có giao dịch
 * POST /api/payment/sepay/webhook
 */
export const sepayWebhook = async (req, res) => {
  try {
    console.log("=== sepayWebhook incoming ===");
    console.log("body:", req.body);

    // Sepay gửi thông tin giao dịch qua webhook
    const { content, transferAmount, transferType, id, gateway } = req.body;

    // Verify signature nếu Sepay có cung cấp
    // const signature = req.headers["x-sepay-signature"];
    // if (!verifySignature(req.body, signature)) {
    //   return res.status(400).json({ message: "Invalid signature" });
    // }

    if (transferType !== "in") {
      // Chỉ xử lý giao dịch tiền vào
      return res.json({ message: "Ignored outgoing transfer" });
    }

    // Tìm booking từ nội dung chuyển khoản (content chứa mã booking)
    // Content thường có format: "BKXXXXX" hoặc chứa booking code
    const codeMatch = content?.match(/BK[A-Z0-9]+/i);
    if (!codeMatch) {
      console.log("No booking code found in content:", content);
      return res.json({ message: "No booking code found" });
    }

    const bookingCode = codeMatch[0].toUpperCase();
    const booking = await Booking.findOne({ code: bookingCode });

    if (!booking) {
      console.log("Booking not found:", bookingCode);
      return res.json({ message: "Booking not found" });
    }

    // Idempotent check
    const ref = String(id || gateway || Date.now());
    if (booking.paymentRefs?.some((p) => p.provider === "sepay" && p.ref === ref)) {
      return res.json({ message: "Already processed" });
    }

    // Cập nhật thanh toán
    const amount = Number(transferAmount) || 0;
    booking.paidAmount = (booking.paidAmount || 0) + amount;
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "sepay",
      ref,
      amount,
      at: new Date(),
    });

    const depositThreshold = booking.totalPrice * 0.5;
    if (!booking.depositPaid && booking.paidAmount >= depositThreshold) {
      booking.depositPaid = true;
      if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
    }
    if (booking.paidAmount >= booking.totalPrice) booking.bookingStatus = "completed";

    await booking.save();

    console.log("Sepay payment recorded for booking:", bookingCode, "amount:", amount);
    return res.json({ success: true, message: "Payment recorded", bookingCode });
  } catch (err) {
    console.error("sepayWebhook error", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Kiểm tra trạng thái thanh toán
 * GET /api/payment/sepay/check/:code
 */
export const sepayCheck = async (req, res) => {
  try {
    const { code } = req.params;
    const booking = await Booking.findOne({ code });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const isPaid = booking.paidAmount >= booking.totalPrice;
    const depositPaid = booking.depositPaid;

    return res.json({
      code: booking.code,
      totalPrice: booking.totalPrice,
      paidAmount: booking.paidAmount,
      remain: Math.max(0, booking.totalPrice - booking.paidAmount),
      isPaid,
      depositPaid,
      status: booking.bookingStatus,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
