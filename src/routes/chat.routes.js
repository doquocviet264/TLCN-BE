// src/routes/chat.routes.js
import { Router } from "express";
// Import thêm optionalAuth
import { auth, optionalAuth, adminOnly } from "../middleware/auth.js";
import {
  // booking chat
  getBookingMessages,
  sendBookingMessage,
  // support chat
  startSupportChat,
  getSupportMessages,
  sendSupportMessage,
  getUserSupportChats,
  getUserChatHistory,
  // admin
  getAllSupportChats,
  getAllBookingChats,
  closeSupportChat,
} from "../controllers/chat.controller.js";

const router = Router();

/* ========== BOOKING CHAT (Bắt buộc Auth) ========== */
router.get("/booking/:code", auth, getBookingMessages);
router.post("/booking/:code", auth, sendBookingMessage);

/* ========== SUPPORT CHAT (QUAN TRỌNG: Dùng optionalAuth) ========== */
// Nếu có token (Admin/User) -> req.user có dữ liệu -> Role đúng
// Nếu không token (Guest) -> req.user null -> Role guest

router.post("/support/start", optionalAuth, startSupportChat);

router.get("/support/:supportId", optionalAuth, getSupportMessages);

router.post("/support/:supportId", optionalAuth, sendSupportMessage);

/* ========== USER CHAT HISTORY ========== */
router.get("/user/support", optionalAuth, getUserSupportChats);
router.get("/user/history", optionalAuth, getUserChatHistory);

/* ========== ADMIN APIs (Bắt buộc Auth) ========== */
router.get("/admin/support", auth, adminOnly, getAllSupportChats);
router.patch("/admin/support/:supportId/close", auth, adminOnly, closeSupportChat);
router.get("/admin/bookings", auth, adminOnly, getAllBookingChats);

export default router;
