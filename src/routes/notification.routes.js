import express from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { auth as verifyToken, adminOnly as verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// ==================== USER ROUTES ====================
// Yêu cầu đăng nhập (verifyToken)
router.get("/me", verifyToken, getMyNotifications);
router.get("/unread-count", verifyToken, getUnreadCount);
router.patch("/read-all", verifyToken, markAllAsRead);
router.patch("/:id/read", verifyToken, markAsRead);

// ==================== ADMIN ROUTES ====================
// Yêu cầu quyền Admin (verifyAdmin)
router.get("/admin", verifyAdmin, getAllNotifications);
router.get("/admin/:id", verifyAdmin, getNotificationById);
router.post("/admin", verifyAdmin, createNotification);
router.put("/admin/:id", verifyAdmin, updateNotification);
router.delete("/admin/:id", verifyAdmin, deleteNotification);

export default router;
