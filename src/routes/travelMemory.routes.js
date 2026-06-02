import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { uploadBlogMem } from "../middleware/upload.js";
import {
  getMyMemories,
  uploadMemoryImages,
  createMemory,
  createMemoryFromBooking,
  getPublicMemories,
  likeMemory,
  unlikeMemory,
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

// POST /api/travel-memories/:id/like - Thích
router.post("/:id/like", auth, likeMemory);

// DELETE /api/travel-memories/:id/like - Bỏ thích
router.delete("/:id/like", auth, unlikeMemory);

export default router;
