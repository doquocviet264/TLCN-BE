import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { uploadBlogMem } from "../middleware/upload.js";
import {
  getMyMemories,
  uploadMemoryImages,
  createMemory,
  createMemoryFromBooking,
  getPublicMemories,
  getUserPublicMemories,
  getMemoryById,
  updateMemory,
  deleteMemory,
  getMemoryComments,
  createMemoryComment,
  deleteMemoryComment,
  likeMemory,
  unlikeMemory,
  shareMemory,
} from "../controllers/travelMemory.controller.js";

const router = Router();

// GET /api/travel-memories/me - Lấy timeline cá nhân
router.get("/me", auth, getMyMemories);

// POST /api/travel-memories - Tạo kỷ niệm mới (Thủ công)
router.post("/", auth, createMemory);

// POST /api/travel-memories/from-booking/:bookingId - Tạo kỷ niệm từ booking đã đi
router.post("/from-booking/:bookingId", auth, createMemoryFromBooking);

router.post(
  "/upload-images",
  auth,
  uploadBlogMem.array("images", 3),
  uploadMemoryImages
);

// GET /api/travel-memories/public - Lấy timeline cộng đồng
router.get("/public", auth, getPublicMemories);

// GET /api/travel-memories/profile/:userId - Trang cá nhân công khai của 1 người dùng
router.get("/profile/:userId", auth, getUserPublicMemories);

// POST /api/travel-memories/:id/like - Thích
router.get("/:id/comments", auth, getMemoryComments);
router.post("/:id/comments", auth, createMemoryComment);
router.delete("/:id/comments/:commentId", auth, deleteMemoryComment);

router.post("/:id/like", auth, likeMemory);

// DELETE /api/travel-memories/:id/like - Bỏ thích
router.delete("/:id/like", auth, unlikeMemory);

// POST /api/travel-memories/:id/share - Chia sẻ nhẹ (tăng lượt chia sẻ)
router.post("/:id/share", auth, shareMemory);

// PATCH /api/travel-memories/:id - Sửa bài (chỉ caption + privacy)
router.patch("/:id", auth, updateMemory);

// DELETE /api/travel-memories/:id - Xóa bài viết
router.delete("/:id", auth, deleteMemory);

// GET /api/travel-memories/:id - Lấy 1 bài theo id (mở từ link chia sẻ)
router.get("/:id", auth, getMemoryById);

export default router;
