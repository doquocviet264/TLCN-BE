// src/controllers/chat.controller.js
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Chat } from "../models/Chat.js";

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

/* Kiểm tra quyền vào nhóm chat tour
   Lưu ý: roomId có thể là tourId hoặc departureId
   - Nếu là departureId: Kiểm tra quyền dựa trên TourDeparture
   - Nếu là tourId: Kiểm tra quyền dựa trên Tour (backward compat)
*/
async function canAccessTourRoom(user, roomId) {
  const role = getRole(user);
  if (!user) return false;
  if (role === "admin") return true;

  if (!mongoose.isValidObjectId(roomId)) return false;

  // Thử tìm TourDeparture trước (chat theo departure)
  const departure = await TourDeparture.findById(roomId).select("leaderId tourId");

  if (departure) {
    // Nếu là departure ID
    if (role === "leader") {
      if (departure.leaderId && String(departure.leaderId) === String(user.id)) return true;
    }

    if (role === "user") {
      const hasBooking = await Booking.exists({
        tourDepartureId: roomId,
        userId: user.id,
        bookingStatus: { $nin: CANCELLED_BOOKING_STATUSES },
      });
      if (hasBooking) return true;
    }
    return false;
  }

  // Fallback: Kiểm tra nếu là Tour ID (backward compat)
  if (role === "leader") {
    const tour = await Tour.findById(roomId).select("leaderId");
    if (tour && String(tour.leaderId) === String(user.id)) return true;
  }

  if (role === "user") {
    const hasBooking = await Booking.exists({
      tourId: roomId,
      userId: user.id,
      bookingStatus: { $nin: CANCELLED_BOOKING_STATUSES },
    });
    if (hasBooking) return true;
  }

  return false;
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
    });

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

    const exists = await Chat.exists({ roomType: "support", supportId });
    if (!exists)
      return res.status(404).json({ message: "Support thread not found" });

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
    };

    // Chỉ lưu name/email nếu là guest gửi
    if (role === "guest") {
      msgData.name = name || "";
      msgData.email = email || "";
    }

    const msg = await Chat.create(msgData);

    res.status(201).json({ message: "Sent", data: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================
 * 3) TOUR GROUP CHAT
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
      .sort({ createdAt: 1 })
      .lean();

    res.json({ tourId, total: msgs.length, data: msgs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/chat/tour/:tourId
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
      isSystem: false,
    });

    res.status(201).json({ message: "Sent", data: msg });
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
    const threads = await Chat.aggregate([
      { $match: { roomType: "support" } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$supportId",
          supportId: { $first: "$supportId" },
          name: { $max: "$name" },
          email: { $max: "$email" },
          lastMessage: { $first: "$content" },
          lastTime: { $first: "$createdAt" },
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { lastTime: -1 } },
    ]);

    res.json({ total: threads.length, data: threads });
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

// GET /api/chat/admin/tours
export const getAllTourChats = async (req, res) => {
  try {
    const threads = await Chat.aggregate([
      { $match: { roomType: "tour" } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$tourId",
          tourId: { $first: "$tourId" },
          lastMessage: { $first: "$content" },
          lastTime: { $first: "$createdAt" },
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { lastTime: -1 } },
      // Try lookup as departure first
      {
        $lookup: {
          from: "tbl_tour_departures",
          localField: "tourId",
          foreignField: "_id",
          as: "departure",
        },
      },
      // Lookup tour từ departure hoặc trực tiếp
      {
        $lookup: {
          from: "tbl_tour",
          let: {
            depTourId: { $arrayElemAt: ["$departure.tourId", 0] },
            directTourId: "$tourId"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$depTourId"] },
                    { $eq: ["$_id", "$$directTourId"] }
                  ]
                }
              }
            }
          ],
          as: "tour",
        },
      },
      {
        $addFields: {
          tourTitle: { $arrayElemAt: ["$tour.title", 0] },
          startDate: { $arrayElemAt: ["$departure.startDate", 0] },
          endDate: { $arrayElemAt: ["$departure.endDate", 0] },
          isDeparture: { $gt: [{ $size: "$departure" }, 0] },
        },
      },
      {
        $project: {
          tour: 0,
          departure: 0,
        },
      },
    ]);

    res.json({ total: threads.length, data: threads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
