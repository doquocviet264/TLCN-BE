// src/controllers/chat.controller.js
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Chat } from "../models/Chat.js";
import { getIO } from "../socket.js";

const CANCELLED_BOOKING_STATUSES = ["cancelled", "x"];

/* Helper: xác định role từ token */
function getRole(user) {
  if (!user) return "guest";

  // Chuyển về chữ thường để so sánh cho chắc chắn
  const r = (user.role || "").toLowerCase();

  if (r === "admin") return "admin";
  if (r === "leader") return "leader";

  return "user";
}

/* Kiểm tra quyền truy cập 1 booking (booking chat) */
async function canAccessBooking(user, booking) {
  const role = getRole(user);
  if (!booking) return false;
  if (!user) return false;

  if (role === "admin") return true;
  if (role === "user" && String(booking.userId) === String(user.id))
    return true;

  if (role === "leader") {
    if (booking.tourDepartureId) {
      const departure = await TourDeparture.findById(booking.tourDepartureId).select("leaderId");
      if (departure?.leaderId && String(departure.leaderId) === String(user.id)) return true;
    }

    if (booking.tourId) {
      const tour = await Tour.findById(booking.tourId).select("leaderId");
      if (tour && String(tour.leaderId) === String(user.id)) return true;
    }
  }

  return false;
}

async function getSupportThreadList(match = {}) {
  return Chat.aggregate([
    { $match: { roomType: "support", ...match } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$supportId",
        supportId: { $first: "$supportId" },
        name: { $max: "$name" },
        email: { $max: "$email" },
        status: { $first: { $ifNull: ["$status", "active"] } },
        lastMessage: { $first: "$content" },
        lastTime: { $first: "$createdAt" },
        updatedAt: { $first: "$createdAt" },
        createdAt: { $min: "$createdAt" },
        messageCount: { $sum: 1 },
      },
    },
    { $sort: { lastTime: -1 } },
  ]);
}

async function getSupportIdsForUser(user) {
  if (!user?.id || !mongoose.isValidObjectId(user.id)) return [];

  const rows = await Chat.aggregate([
    {
      $match: {
        roomType: "support",
        fromId: new mongoose.Types.ObjectId(user.id),
      },
    },
    { $group: { _id: "$supportId" } },
  ]);

  return rows.map((row) => row._id).filter(Boolean);
}


/* =========================
 * 1) BOOKING CHAT
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
      bookingCode: code,
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      roomType: "booking",
      bookingCode: code,
      total: messages.length,
      data: messages,
    });
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
      tourId: booking.tourDepartureId || booking.tourId,
      fromId: new mongoose.Types.ObjectId(req.user.id),
      fromRole: role,
      content: content.trim(),
      isSystem: false,
      status: "active",
    });

    const io = getIO();
    io.to(code).emit("receive_message", msg);

    res.status(201).json({ message: "Sent", data: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================
 * 2) SUPPORT CHAT (Đã fix role cho Admin)
 * ========================================= */

// POST /api/chat/support/start
export const startSupportChat = async (req, res) => {
  try {
    const { name, email, content } = req.body || {};
    const user = req.user;

    if (!user) {
      if (!email && !name) {
        return res
          .status(400)
          .json({ message: "Name or email is required for guest" });
      }
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const supportId =
      "SUP-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    const role = user ? getRole(user) : "guest";

    const msg = await Chat.create({
      roomType: "support",
      supportId,
      fromId: user ? new mongoose.Types.ObjectId(user.id) : undefined,
      fromRole: role,
      name: user?.fullName || name || "",
      email: user?.email || email || "",
      content: content.trim(),
      isSystem: false,
      status: "active",
    });

    res.status(201).json({
      message: "Support chat started",
      supportId,
      firstMessage: msg,
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
      .sort({ createdAt: 1 })
      .lean();

    if (!msgs.length) {
      return res.status(404).json({ message: "Support thread not found" });
    }

    res.json({ supportId, total: msgs.length, data: msgs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/support/:supportId
export const sendSupportMessage = async (req, res) => {
  try {
    const { supportId } = req.params;
    const { content, name, email } = req.body || {};
    const user = req.user;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const latest = await Chat.findOne({ roomType: "support", supportId })
      .sort({ createdAt: -1 })
      .select("status")
      .lean();
    if (!latest)
      return res.status(404).json({ message: "Support thread not found" });
    if (latest.status === "closed") {
      return res.status(400).json({ message: "Support thread is closed" });
    }

    // --- ĐÂY LÀ CHỖ QUAN TRỌNG ĐỂ NHẬN DIỆN ADMIN ---
    // Nhờ middleware optionalAuth, req.user sẽ có dữ liệu nếu là Admin
    const role = user ? getRole(user) : "guest";

    const msgData = {
      roomType: "support",
      supportId,
      fromId: user ? new mongoose.Types.ObjectId(user.id) : undefined,
      fromRole: role,
      content: content.trim(),
      isSystem: false,
      status: "active",
    };

    // Chỉ lưu name/email nếu là guest gửi
    if (role === "guest") {
      msgData.name = name || "";
      msgData.email = email || "";
    }

    const msg = await Chat.create(msgData);

    const io = getIO();
    io.to(supportId).emit("receive_message", msg);

    res.status(201).json({ message: "Sent", data: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/chat/user/support
export const getUserSupportChats = async (req, res) => {
  try {
    const supportIds = await getSupportIdsForUser(req.user);
    if (!supportIds.length) {
      return res.json({ total: 0, data: [] });
    }

    const threads = await getSupportThreadList({ supportId: { $in: supportIds } });
    res.json({ total: threads.length, data: threads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/chat/user/history
export const getUserChatHistory = async (req, res) => {
  try {
    const supportIds = await getSupportIdsForUser(req.user);
    const supportChats = supportIds.length
      ? await getSupportThreadList({ supportId: { $in: supportIds } })
      : [];

    res.json({
      supportChats,
      bookingChats: [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================
 * 4) ADMIN APIs (Đã fix Join bảng để hiển thị tên user)
 * ========================================= */

// GET /api/chat/admin/support
export const getAllSupportChats = async (req, res) => {
  try {
    const threads = await getSupportThreadList();

    res.json({ total: threads.length, data: threads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/chat/admin/support/:supportId/close
export const closeSupportChat = async (req, res) => {
  try {
    const { supportId } = req.params;
    const result = await Chat.updateMany(
      { roomType: "support", supportId },
      { $set: { status: "closed" } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: "Support thread not found" });
    }

    const io = getIO();
    io.to(supportId).emit("support_closed", { supportId, status: "closed" });

    res.json({ message: "Support chat closed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/chat/admin/bookings
export const getAllBookingChats = async (req, res) => {
  try {
    const threads = await Chat.aggregate([
      { $match: { roomType: "booking" } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$bookingCode",
          bookingCode: { $first: "$bookingCode" },
          tourId: { $first: "$tourId" },
          lastMessage: { $first: "$content" },
          lastTime: { $first: "$createdAt" },
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { lastTime: -1 } },
      // Join Tour để lấy tên
      {
        $lookup: {
          from: "tbl_tour", // ⚠️ CHECK TÊN COLLECTION DB CỦA BẠN (VD: tours hoặc tbl_tour)
          localField: "tourId",
          foreignField: "_id",
          as: "tour",
        },
      },
      // Join Booking để lấy userId
      {
        $lookup: {
          from: "tbl_booking", // ⚠️ CHECK TÊN COLLECTION DB
          localField: "bookingCode",
          foreignField: "code",
          as: "bookingInfo",
        },
      },
      { $unwind: { path: "$bookingInfo", preserveNullAndEmptyArrays: true } },
      // Join User để lấy tên khách
      {
        $lookup: {
          from: "tbl_user", // ⚠️ CHECK TÊN COLLECTION DB
          localField: "bookingInfo.userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          bookingCode: 1,
          tourId: 1,
          lastMessage: 1,
          lastTime: 1,
          messageCount: 1,
          tourTitle: { $arrayElemAt: ["$tour.title", 0] },
          name: { $ifNull: ["$userInfo.fullName", "Khách hàng"] },
          email: { $ifNull: ["$userInfo.email", ""] },
        },
      },
    ]);

    res.json({ total: threads.length, data: threads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

