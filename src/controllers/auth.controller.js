import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { sendMail } from "../services/mailer.js";

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { fullName, username, email, password, phoneNumber } = req.body;

    // check trùng username/email
    const exist = await User.findOne({ $or: [{ email }, { username }] });
    if (exist) {
      const field = exist.email === email ? "email" : "username";
      return res.status(400).json({ message: `${field} already exists` });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      username,
      email,
      password: hash,
      phoneNumber,
      isActive: "y",
      status: "y",
    });

    res.status(201).json({
      message: "Registered",
      user: { id: String(user._id), fullName, username, email, phoneNumber },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const find = identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { username: identifier };

    const user = await User.findOne(find);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.password)
      return res.status(400).json({ message: "This account uses Google Login" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Wrong password" });

    const accessToken = jwt.sign(
      { id: String(user._id), role: "user" }, // đổi type -> role
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );
    
    const refreshToken = jwt.sign(
      { id: String(user._id), type: "refresh" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    
    res.cookie("token", accessToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // Return full user info and tokens
    res.json({
      message: "Login success",
      accessToken,
      refreshToken,
      user: {
        id: String(user._id),
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phoneNumber,
        avatar: user.avatar || "/Image.svg",
        points: user.points || 0,
        memberStatus: user.memberStatus || "Thành viên",
        isActive: user.isActive,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/forgot-password
export const resetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Mongoose: tìm trực tiếp theo email
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found" });

    const newPass = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    user.password = await bcrypt.hash(newPass, 10);
    await user.save();

    await sendMail({
      to: email,
      subject: "Reset password",
      html: `<p>Your new password: <b>${newPass}</b></p>`,
    });

    res.json({ message: "New password sent to email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/logout
export const logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
};

// GET /api/auth/me - Get current user profile
export const getProfile = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: String(user._id),
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phoneNumber,
      avatar: user.avatar || "/Image.svg",
      points: user.points || 0,
      memberStatus: user.memberStatus || "Thành viên",
      isActive: user.isActive,
      status: user.status,
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    res.status(500).json({ message: err.message });
  }
};
