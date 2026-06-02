// src/routes/checkin.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js"; // Middleware xác thực User
import {
  getUserJourney,
  getFullJourney,
  createCheckin,
  getMyVouchers,
} from "../controllers/checkin.controller.js";
const router = Router();

// Định nghĩa đường dẫn: /api/checkins/journey
// GET: Lấy danh sách đã đi
router.get("/journey", auth, getUserJourney);
router.get("/full-journey", auth, getFullJourney);
router.get("/vouchers", auth, getMyVouchers);

// POST: Tạo check-in mới
router.post("/", auth, createCheckin); // Giờ thì nó sẽ hiểu hàm này lấy từ đâu rồi
export default router;
