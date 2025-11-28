import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  // booking chat
  getBookingMessages,
  sendBookingMessage,
  // support chat
  startSupportChat,
  getSupportMessages,
  sendSupportMessage,
  // tour group
  getTourGroupMessages,
  sendTourGroupMessage
} from "../controllers/chat.controller.js";

const router = Router();

/* ========== BOOKING CHAT ========== */
/**
 * @openapi
 * /api/chat/booking/{code}:
 *   get:
 *     tags: [Chat]
 *     summary: Lấy tin nhắn theo booking
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 */
router.get("/booking/:code", auth, getBookingMessages);

/**
 * @openapi
 * /api/chat/booking/{code}:
 *   post:
 *     tags: [Chat]
 *     summary: Gửi tin nhắn trong phòng chat booking
 *     security:
 *       - bearerAuth: []
 */
router.post("/booking/:code", auth, sendBookingMessage);


/* ========== SUPPORT CHAT (guest & user) ========== */
/**
 * @openapi
 * /api/chat/support/start:
 *   post:
 *     tags: [Chat]
 *     summary: Bắt đầu cuộc chat tư vấn (chưa đặt tour)
 *     description: Nếu đã đăng nhập sẽ gắn với tài khoản, nếu không thì dùng name/email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Nguyễn A" }
 *               email: { type: string, example: "a@example.com" }
 *               content: { type: string, example: "Em muốn tư vấn tour Đà Lạt 3N2Đ." }
 *     responses:
 *       201:
 *         description: Tạo supportId
 */
router.post("/support/start", startSupportChat);

/**
 * @openapi
 * /api/chat/support/{supportId}:
 *   get:
 *     tags: [Chat]
 *     summary: Xem lịch sử chat tư vấn
 *   post:
 *     tags: [Chat]
 *     summary: Gửi tin nhắn vào cuộc chat tư vấn
 */
router.get("/support/:supportId", getSupportMessages);
router.post("/support/:supportId", sendSupportMessage);


/* ========== TOUR GROUP CHAT ========== */
/**
 * @openapi
 * /api/chat/tour/{tourId}:
 *   get:
 *     tags: [Chat]
 *     summary: Xem nhóm chat chung của tour
 *     security:
 *       - bearerAuth: []
 *   post:
 *     tags: [Chat]
 *     summary: Gửi tin nhắn vào nhóm chat chung của tour
 *     security:
 *       - bearerAuth: []
 */
router.get("/tour/:tourId", auth, getTourGroupMessages);
router.post("/tour/:tourId", auth, sendTourGroupMessage);

export default router;
