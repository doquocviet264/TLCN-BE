import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { TourDeparture } from "../models/TourDeparture.js"; // kiểm tra quyền sở hữu departure

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

// 5. Kiểm tra Leader có sở hữu Departure này không (dùng trong leader.routes.js)
export const leaderOwnsDeparture = async (req, res, next) => {
  try {
    const { id } = req.params; // departureId

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid departure id" });
    }

    const departure = await TourDeparture.findById(id).select("_id leaderId");

    if (!departure) {
      return res.status(404).json({ message: "Departure not found" });
    }

    if (String(departure.leaderId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden (not your departure)" });
    }

    next();
  } catch (error) {
    console.error("LeaderOwnsDeparture Middleware Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @deprecated use leaderOwnsDeparture instead
 * Kept for backward-compat with old routes that used Tour
 */
export const leaderOwnsTour = leaderOwnsDeparture;
