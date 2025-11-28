// src/controllers/leader.auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Leader } from "../models/Leader.js";

export const leaderLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier & password are required" });
    }

    const find = identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { username: identifier };

    const leader = await Leader.findOne(find);
    if (!leader) return res.status(404).json({ message: "Leader not found" });
    if (leader.status !== "active") return res.status(403).json({ message: "Leader inactive" });

    const ok = await bcrypt.compare(password, leader.password || "");
    if (!ok) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: String(leader._id), role: "leader" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    });

    // ✅ ĐỪNG QUÊN TRẢ VỀ JSON
    return res.json({
      message: "Leader login success",
      token,
      leader: {
        id: String(leader._id),
        username: leader.username,
        fullName: leader.fullName,
        email: leader.email,
        status: leader.status,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const LeaderLogout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
};
