// Giả định bạn đang sử dụng Mongoose/MongoDB, nên giữ lại import này.
import { Booking } from "../models/Booking.js";
// Import cấu hình VNPAY từ file config.
import { vnpConfig } from "../config/vnpay.js";
// Import buildVNPayPayUrl từ utils
import { buildVNPayPayUrl } from "../utils/vnpay.js";

/**
 * Xử lý tạo URL thanh toán VNPAY
 */
export const vnpCreate = async (req, res) => {
  try {
    // Ghi log để kiểm tra dữ liệu đầu vào từ client
    console.log("=== vnpCreate incoming ===");
    console.log("headers:", req.headers);
    console.log("query:", req.query);
    console.log("body:", req.body);

    // Lấy mã booking (code) và số tiền (amount) từ body hoặc query
    const code =
      req.body?.code ??
      req.body?.bookingCode ??
      req.body?.orderId ??
      req.query?.code ??
      req.query?.bookingCode ??
      (req.body?.booking && req.body.booking.code);

    const amount =
      req.body?.amount ??
      req.body?.totalPrice ??
      req.body?.payAmount ??
      req.query?.amount ??
      req.query?.totalPrice ??
      (req.body?.booking && req.body.booking.totalPrice);

    console.log("parsed code, amount:", code, amount);

    // 1. Kiểm tra đầu vào
    if (!code) return res.status(400).json({ message: "code is required" });
    if (!amount || Number(amount) <= 0)
      return res
        .status(400)
        .json({ message: "amount must be a positive number" });

    // 2. Tìm Booking và kiểm tra số tiền còn lại
    const booking = await Booking.findOne({ code });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const totalPrice = booking.totalPrice || 0;
    const paid = booking.paidAmount || 0;
    const remain = Math.max(0, totalPrice - paid);
    if (remain <= 0)
      return res.status(400).json({ message: "No remaining amount to pay" });

    const payAmount = Number(amount);
    if (payAmount > remain) {
      return res.status(400).json({
        message: "amount cannot be greater than remaining amount",
        remain,
      });
    }

    // 3. Chuẩn bị tham số VNPAY
    // Tạo transaction reference: chỉ alphanumeric, không dấu gạch ngang
    const txnRef = `${booking.code}${Date.now()}`;

    // Số tiền (VND)
    const payAmount_VND = payAmount;

    // Dùng utility function từ utils/vnpay.js để build URL (đảm bảo encoding nhất quán)
    const payUrl = buildVNPayPayUrl({
      vnpUrl: vnpConfig.vnpUrl || process.env.VNP_URL,
      tmnCode: vnpConfig.tmnCode || process.env.VNP_TMNCODE,
      hashSecret: vnpConfig.hashSecret || process.env.VNP_HASHSECRET,
      amountVND: payAmount_VND,
      orderInfo: `Thanhtoanbooking${booking.code}`,
      txnRef,
      ipAddr:
        (req.ip === "::1" ? "127.0.0.1" : req.ip) ||
        req.headers["x-forwarded-for"] ||
        "127.0.0.1",
      returnUrl: vnpConfig.returnUrl || process.env.VNP_RETURN_URL,
      locale: "vn",
      currCode: "VND",
    });

    // 6. Lưu thông tin giao dịch vào Booking (tùy chọn)
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "vnpay",
      ref: txnRef,
      amount: payAmount,
      at: new Date(),
    });
    await booking.save();

    console.log("-> returning payUrl", payUrl);
    // 7. Trả về URL cho Client
    return res.json({ payUrl, txnRef, remain, payAmount });
  } catch (err) {
    console.error("vnpCreate error", err);
    return res.status(500).json({ message: err.message });
  }
};
