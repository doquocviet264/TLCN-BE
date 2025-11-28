// src/middleware/auth.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Tour } from "../models/Tour.js";

export const auth = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // CHUẨN HOÁ: chấp nhận token cũ {type} hoặc mới {role}
    decoded.role = decoded.role || decoded.type || "user";
    req.user = decoded; // { id, role }
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

export const leaderOnly = (req, res, next) => {
  if (req.user?.role !== "leader") {
    return res.status(403).json({ message: "Forbidden (leader only)" });
  }
  next();
};

// Leader chỉ thao tác tour đã được phân công
export const leaderOwnsTour = async (req, res, next) => {
  const { id } = req.params; // tourId
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid tour id" });
  }
  const tour = await Tour.findById(id).select("_id leaderId");
  if (!tour) return res.status(404).json({ message: "Tour not found" });
  if (String(tour.leaderId) !== String(req.user.id)) {
    return res.status(403).json({ message: "Forbidden (not your tour)" });
  }
  next();
};
