import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";
import { Chat } from "../models/Chat.js";

/* Helper: xác định role từ token */
function getRole(user) {
  if (!user) return "guest";
  if (user.role === "admin")  return "admin";
  if (user.role === "leader") return "leader";
  return "user";
}

/* Kiểm tra quyền truy cập 1 booking (booking chat) */
async function canAccessBooking(user, booking) {
  const role = getRole(user);
  if (!booking) return false;
  if (!user) return false;

  if (role === "admin") return true;
  if (role === "user" && String(booking.userId) === String(user.id)) return true;

  if (role === "leader") {
    const tour = await Tour.findById(booking.tourId).select("leaderId");
    if (tour && String(tour.leaderId) === String(user.id)) return true;
  }

  return false;
}

/* Kiểm tra quyền vào nhóm chat tour */
async function canAccessTourRoom(user, tourId) {
  const role = getRole(user);
  if (!user) return false;
  if (role === "admin") return true;

  if (!mongoose.isValidObjectId(tourId)) return false;

  if (role === "leader") {
    const tour = await Tour.findById(tourId).select("leaderId");
    if (tour && String(tour.leaderId) === String(user.id)) return true;
  }

  if (role === "user") {
    const hasBooking = await Booking.exists({
      tourId,
      userId: user.id,
      bookingStatus: { $ne: "x" } // exclude canceled
    });
    if (hasBooking) return true;
  }

  return false;
}

/* =========================
 *  1) BOOKING CHAT (đã có)
 * ========================= */

// GET /api/chat/booking/:code
export const getBookingMessages = async (req, res) => {
  try {
    const { code } = req.params;

    const booking = await Booking.findOne({ code }).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const ok = await canAccessBooking(req.user, booking);
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    const messages = await Chat.find({
      roomType: { $in: ["booking", null] },
      bookingCode: code
    }).sort({ createdAt: 1 }).lean();

    res.json({ roomType: "booking", bookingCode: code, total: messages.length, data: messages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/booking/:code
export const sendBookingMessage = async (req, res) => {
  try {
    const { code } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const booking = await Booking.findOne({ code }).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const ok = await canAccessBooking(req.user, booking);
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    const role = getRole(req.user);

    const msg = await Chat.create({
      roomType: "booking",
      bookingCode: code,
      tourId: booking.tourId,
      fromId: new mongoose.Types.ObjectId(req.user.id),
      fromRole: role,
      content: content.trim(),
      isSystem: false
    });

    res.status(201).json({ message: "Sent", data: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================
 *  2) SUPPORT CHAT (chưa đặt tour)
 *  - không cần login
 *  - mỗi cuộc = 1 supportId
 * ========================================= */

// POST /api/chat/support/start
// body: { name, email, content }
export const startSupportChat = async (req, res) => {
  try {
    const { name, email, content } = req.body || {};
    const user = req.user; // nếu có token thì ưu tiên gán cho user

    if (!user) {
      // guest bắt buộc cần tối thiểu 1 kênh liên hệ
      if (!email && !name) {
        return res.status(400).json({ message: "Name or email is required for guest" });
      }
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const supportId = "SUP-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    const role = user ? getRole(user) : "guest";

    const msg = await Chat.create({
      roomType: "support",
      supportId,
      fromId: user ? new mongoose.Types.ObjectId(user.id) : undefined,
      fromRole: role,
      name: user?.fullName || name || "",
      email: user?.email || email || "",
      content: content.trim(),
      isSystem: false
    });

    res.status(201).json({
      message: "Support chat started",
      supportId,
      firstMessage: msg
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/chat/support/:supportId
export const getSupportMessages = async (req, res) => {
  try {
    const { supportId } = req.params;
    const msgs = await Chat.find({ roomType: "support", supportId })
      .sort({ createdAt: 1 }).lean();

    if (!msgs.length) {
      return res.status(404).json({ message: "Support thread not found" });
    }

    res.json({ supportId, total: msgs.length, data: msgs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/support/:supportId
// body: { content, name?, email? } (guest tiếp tục chat)
export const sendSupportMessage = async (req, res) => {
  try {
    const { supportId } = req.params;
    const { content, name, email } = req.body || {};
    const user = req.user;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    // kiểm tra thread tồn tại
    const exists = await Chat.exists({ roomType: "support", supportId });
    if (!exists) return res.status(404).json({ message: "Support thread not found" });

    const role = user ? getRole(user) : "guest";

    const msg = await Chat.create({
      roomType: "support",
      supportId,
      fromId: user ? new mongoose.Types.ObjectId(user.id) : undefined,
      fromRole: role,
      name: user?.fullName || name || "",
      email: user?.email || email || "",
      content: content.trim(),
      isSystem: false
    });

    res.status(201).json({ message: "Sent", data: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================
 *  3) TOUR GROUP CHAT (dành cho đã đặt tour)
 *  - Chỉ admin / leader / user có booking tour đó
 * ========================================= */

// GET /api/chat/tour/:tourId
export const getTourGroupMessages = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }

    const ok = await canAccessTourRoom(req.user, tourId);
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    const msgs = await Chat.find({ roomType: "tour", tourId })
      .sort({ createdAt: 1 }).lean();

    res.json({ tourId, total: msgs.length, data: msgs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/tour/:tourId
// body: { content }
export const sendTourGroupMessage = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { content } = req.body || {};

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const ok = await canAccessTourRoom(req.user, tourId);
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    const role = getRole(req.user);

    const msg = await Chat.create({
      roomType: "tour",
      tourId,
      fromId: new mongoose.Types.ObjectId(req.user.id),
      fromRole: role,
      content: content.trim(),
      isSystem: false
    });

    res.status(201).json({ message: "Sent", data: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
