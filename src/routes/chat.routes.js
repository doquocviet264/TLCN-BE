// src/routes/chat.routes.js
import { Router } from "express";
// Import thêm optionalAuth
import { auth, optionalAuth } from "../middleware/auth.js";
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
  sendTourGroupMessage,
  // admin
  getAllSupportChats,
  getAllBookingChats,
  getAllTourChats,
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

/* ========== TOUR GROUP CHAT (Bắt buộc Auth) ========== */
router.get("/tour/:tourId", auth, getTourGroupMessages);
router.post("/tour/:tourId", auth, sendTourGroupMessage);

/* ========== ADMIN APIs (Bắt buộc Auth) ========== */
router.get("/admin/support", auth, getAllSupportChats);
router.get("/admin/bookings", auth, getAllBookingChats);
router.get("/admin/tours", auth, getAllTourChats);

export default router;
