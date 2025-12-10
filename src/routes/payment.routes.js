import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  createVNPayPayment,
  vnpayReturn,
  vnpayIpn,
} from "../controllers/payment.controller.js";

const router = Router();

/**
 * @openapi
 * /api/payment/vnpay:
 *   post:
 *     summary: Tạo URL thanh toán VNPay cho booking
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "BKABCD12"
 *               payFull:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: URL thanh toán VNPay
 */
router.post("/vnpay", auth, createVNPayPayment);

/**
 * @openapi
 * /api/payment/vnpay/return:
 *   get:
 *     summary: VNPay redirect về sau khi thanh toán
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string }
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect về FE
 */
router.get("/vnpay/return", vnpayReturn);

/**
 * @openapi
 * /api/payment/vnpay/ipn:
 *   get:
 *     summary: VNPay IPN (notify server)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: JSON VNP RspCode
 */
router.get("/vnpay/ipn", vnpayIpn);

export default router;
