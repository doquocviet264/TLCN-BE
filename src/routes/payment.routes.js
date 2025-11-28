import { Router } from "express";
import { verifyMoMoIPN } from "../utils/momo.js";
import { onPaymentReceived } from "../controllers/booking.controller.js";
import { auth } from "../middleware/auth.js";
import { vnpReturn, vnpIpn } from "../controllers/payment.controller.js";
const router = Router();

/**
 * MoMo RETURN (User redirect về sau khi thanh toán)
 * Thường MoMo bắn query bằng GET; có thể cấu hình POST.
 * Ở dev, chỉ cần verify signature và gọi onPaymentReceived khi resultCode === 0
 */
router.get("/momo/return", async (req, res) => {
  try {
    const q = req.query;
    const ok = verifyMoMoIPN(q, process.env.MOMO_SECRET_KEY);
    if (!ok) return res.status(400).send("INVALID_SIGNATURE");

    // 0 = success (MoMo)
    if (String(q.resultCode) === "0") {
      req.body = {
        code:    q.orderId,               // booking.code bạn đã set = orderId
        amount:  Number(q.amount),        // VND
        provider:"momo",
        ref:     String(q.transId || q.requestId || "MoMo")
      };
      await onPaymentReceived(req, res);      // cập nhật DB (đã send JSON trong onPaymentReceived)
    } else {
      res.status(400).send("PAYMENT_FAILED:" + q.resultCode);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * MoMo IPN (server-to-server, đáng tin cậy)
 * MoMo thường gửi POST JSON; nhưng sandbox cũng có thể GET.
 * Ta hỗ trợ cả hai bằng cách đọc req.body trước, fallback sang req.query.
 */
router.post("/momo/ipn", async (req, res) => {
  try {
    const q = Object.keys(req.body || {}).length ? req.body : req.query;
    const ok = verifyMoMoIPN(q, process.env.MOMO_SECRET_KEY);
    if (!ok) return res.status(400).json({ message: "INVALID_SIGNATURE" });

    if (String(q.resultCode) === "0") {
      req.body = {
        code:    q.orderId,
        amount:  Number(q.amount),
        provider:"momo",
        ref:     String(q.transId || q.requestId || "MoMo")
      };
      await onPaymentReceived(req, res); // đã res.json bên trong
    } else {
      res.status(400).json({ message: "PAYMENT_FAILED", resultCode: q.resultCode });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Tạo payUrl MoMo để thanh toán phần còn lại của booking
 * body: { code: "BKABC123" }
 * yêu cầu user phải là chủ booking hoặc admin (ở đây ví dụ chỉ cần login và là chủ)
 */
router.post("/momo/create-remaining", auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const booking = await Booking.findOne({ code });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // chỉ cho chủ booking gọi
    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const remain = Math.max(0, (booking.totalPrice || 0) - (booking.paidAmount || 0));
    if (remain <= 0) {
      return res.status(400).json({ message: "No remaining amount" });
    }

    const tour = await Tour.findById(booking.tourId).lean();
    const orderId   = `${booking.code}-remain-${Date.now()}`;
    const requestId = orderId;
    const orderInfo = `Thanh toan phan con lai ${booking.code}`;

    const { payUrl, error, raw } = await createMoMoPayment({
      partnerCode: process.env.MOMO_PARTNER_CODE,
      accessKey:   process.env.MOMO_ACCESS_KEY,
      secretKey:   process.env.MOMO_SECRET_KEY,
      momoApi:     process.env.MOMO_API,
      redirectUrl: process.env.MOMO_REDIRECT_URL,
      ipnUrl:      process.env.MOMO_IPN_URL,
      amountVND:   String(remain),
      orderId, requestId, orderInfo,
      requestType: "captureWallet",
      extraData:   ""
    });

    if (error) {
      return res.status(502).json({ message: "MoMo create payment failed", error, raw });
    }
    res.json({ payUrl, remain });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @openapi
 * /api/payment/vnpay/return:
 *   get:
 *     tags: [Payment]
 *     summary: VNPAY return URL (browser)
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect về FE với status
 */
router.get("/vnpay/return", vnpReturn);

/**
 * @openapi
 * /api/payment/vnpay/ipn:
 *   get:
 *     tags: [Payment]
 *     summary: VNPAY IPN URL (server-to-server)
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: JSON { RspCode, Message }
 */
router.get("/vnpay/ipn", vnpIpn);

export default router;
