import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Tour } from "../models/Tour.js"; // Đảm bảo import Model Tour

// 1. Middleware bắt buộc đăng nhập
export const auth = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Chuẩn hoá role
    decoded.role = decoded.role || decoded.type || "user";
    req.user = decoded; // { id, role }
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// 2. Middleware xác thực tuỳ chọn (Dùng cho Chat Support)
export const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    decoded.role = decoded.role || decoded.type || "user";
    req.user = decoded;
  } catch (err) {
    // Token lỗi thì thôi, vẫn cho qua như Guest
  }

  next();
};

// 3. Chỉ Admin
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

// 4. Chỉ Leader
export const leaderOnly = (req, res, next) => {
  if (req.user?.role !== "leader") {
    return res.status(403).json({ message: "Forbidden (leader only)" });
  }
  next();
};

// 5. Kiểm tra Leader có sở hữu Tour này không (Dùng trong leader.routes.js)
export const leaderOwnsTour = async (req, res, next) => {
  try {
    const { id } = req.params; // tourId thường nằm ở params

    if (!mongoose.isValidObjectId(id)) {
      // Nếu id không hợp lệ, có thể route không có param :id hoặc id sai format
      // Cho qua (next) để controller xử lý hoặc báo lỗi tùy logic route
      // Nhưng thường là báo lỗi luôn:
      return res.status(400).json({ message: "Invalid tour id" });
    }

    const tour = await Tour.findById(id).select("_id leaderId");

    if (!tour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    // So sánh leaderId của tour với user id đang đăng nhập
    if (String(tour.leaderId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden (not your tour)" });
    }

    next();
  } catch (error) {
    console.error("LeaderOwnsTour Middleware Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
