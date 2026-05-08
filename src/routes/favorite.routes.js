import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  toggleFavorite,
  getMyFavorites,
  checkFavorite,
} from "../controllers/favorite.controller.js";

const router = Router();

// Lấy danh sách tour yêu thích của user (Yêu cầu đăng nhập)
router.get("/", auth, getMyFavorites);

// Thêm/Bỏ yêu thích 1 tour (Yêu cầu đăng nhập)
router.post("/toggle", auth, toggleFavorite);

// Kiểm tra 1 tour đã yêu thích chưa (Yêu cầu đăng nhập)
router.get("/check/:tourId", auth, checkFavorite);

export default router;
