import mongoose from "mongoose";
import { Tour } from "../models/Tour.js";
import { Booking } from "../models/Booking.js";
import { sendMail } from "../services/mailer.js";
import { buildVNPayPayUrl } from "../utils/vnpay.js";
import { createMoMoPayment } from "../utils/momo.js";
import { notifyTourConfirmed } from "../services/notify.js";
import axios from "axios";
import crypto from "crypto";

const genCode = () => "BKG" + Math.random().toString(36).slice(2, 8).toUpperCase();
const clientIP = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.connection?.remoteAddress ||
  req.socket?.remoteAddress ||
  "127.0.0.1";

export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.startTransaction();

    console.log("📝 Received booking request:", JSON.stringify(req.body, null, 2));

    // Handle both old flat format and new nested format
    let tourId, numAdults, numChildren, fullName, email, phoneNumber, address, note;
    
    if (req.body.contact) {
      // New format from frontend
      const { tourId: tId, contact, guests, pricing } = req.body;
      tourId = tId;
      numAdults = guests?.adults || 1;
      numChildren = guests?.children || 0;
      fullName = contact?.fullName;
      email = contact?.email;
      phoneNumber = contact?.phone;
      address = contact?.address;
      note = req.body.note;
    } else {
      // Old flat format
      const data = req.body;
      tourId = data.tourId;
      numAdults = data.numAdults || 1;
      numChildren = data.numChildren || 0;
      fullName = data.fullName;
      email = data.email;
      phoneNumber = data.phoneNumber;
      address = data.address;
      note = data.note;
    }

    console.log("🎯 Parsed booking data:", {
      tourId, numAdults, numChildren, fullName, email, phoneNumber, address
    });

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }

    const tour = await Tour.findById(tourId).session(session);
    if (!tour) return res.status(404).json({ message: "Tour not found" });
    if (tour.status === "closed") {
      return res.status(400).json({ message: "Tour is closed" });
    }

    // Số khách đặt
    const guestsRequested = (Number(numAdults) || 0) + (Number(numChildren) || 0);
    if (guestsRequested <= 0) {
      return res.status(400).json({ message: "Invalid guests" });
    }

    // Kiểm tra còn slot
    if (Number.isFinite(tour.quantity)) {
      const after = (tour.current_guests || 0) + guestsRequested;
      if (after > tour.quantity) {
        return res.status(400).json({
          message: "Not enough slots",
          available: Math.max(0, (tour.quantity || 0) - (tour.current_guests || 0))
        });
      }
    }

    const priceAdult = tour.priceAdult ?? 0;
    const priceChild = tour.priceChild ?? Math.round(priceAdult * 0.6);
    const totalPrice = (Number(numAdults) * priceAdult) + (Number(numChildren) * priceChild);
    
    const alreadyConfirmed = tour.status === "confirmed" || (tour.current_guests >= (tour.min_guests || 0));
    const depositRate   = alreadyConfirmed ? 1 : Number(process.env.BOOKING_DEPOSIT_RATE ?? 0.2);
    const depositAmount = Math.round(totalPrice * depositRate);

    const code = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const [booking] = await Booking.create([{
      code,
      tourId,
      userId: req.user.id,
      fullName, email, phoneNumber, address, note,
      numAdults, numChildren,
      totalPrice,
      bookingStatus: "p",
      depositRate, depositAmount,
      paymentMethod: "momo",
      paidAmount: 0,
      depositPaid: false,
      paymentRefs: [],
      requireFullPayment: alreadyConfirmed
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Tạm thời skip MoMo integration để test booking creation
    console.log("🛒 Booking created successfully:", {
      bookingId: booking._id,
      code: booking.code,
      totalPrice: booking.totalPrice,
      depositAmount: booking.depositAmount
    });

    return res.status(201).json({
      message: alreadyConfirmed
        ? "Booking created! Tour is confirmed, full payment required."
        : "Booking created! Please proceed to payment.",
      code: booking.code,
      status: booking.bookingStatus,
      payment: {
        redirectUrl: null  // Will be null for now, can add MoMo URL later
      },
      total: booking.totalPrice,
      // Additional info for debugging
      booking: {
        _id: booking._id,
        code: booking.code,
        tourId: booking.tourId,
        fullName: booking.fullName,
        email: booking.email,
        phoneNumber: booking.phoneNumber,
        address: booking.address,
        numAdults: booking.numAdults,
        numChildren: booking.numChildren,
        totalPrice: booking.totalPrice,
        depositAmount: booking.depositAmount,
        bookingStatus: booking.bookingStatus,
        createdAt: booking.createdAt
      }
    });

  } catch (err) {
    try { if (session.inTransaction()) await session.abortTransaction(); } catch {}
    try { session.endSession(); } catch {}
    return res.status(500).json({ message: err.message });
  }
};




export const onPaymentReceived = async (req, res) => {
  try {
    const { code, amount, provider = "momo", ref = Date.now() } = req.body;
    const booking = await Booking.findOne({ code });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.paymentRefs?.some(p => p.ref === String(ref) && p.provider === provider)) {
      return res.json({ message: "Already processed", booking });
    }

    const wasDeposited = Boolean(booking.depositPaid);
    const isFirstDeposit = !wasDeposited && Number(amount) > 0;

    booking.paidAmount = (booking.paidAmount || 0) + Number(amount || 0);
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({ provider, ref: String(ref), amount: Number(amount||0), at: new Date() });
    if (isFirstDeposit) booking.depositPaid = true;

    if ((booking.paidAmount || 0) >= (booking.totalPrice || Number.MAX_SAFE_INTEGER)) {
      booking.bookingStatus = "c";
    }
    await booking.save();

    if (isFirstDeposit && booking.email) {
      try {
        await sendMail({
          to: booking.email,
          subject: `Đã nhận tiền cọc - ${booking.code}`,
          html: `
            <p>Xin chào ${booking.fullName || "Quý khách"},</p>
            <p>Chúng tôi đã nhận tiền cọc cho đơn <b>${booking.code}</b> với số tiền <b>${Number(amount).toLocaleString()} VND</b>.</p>
            <p>Tổng giá: <b>${(booking.totalPrice||0).toLocaleString()} VND</b> — Đã trả: <b>${(booking.paidAmount||0).toLocaleString()} VND</b>.</p>
            <p>Chúng tôi sẽ thông báo ngay khi tour xác nhận khởi hành.</p>
          `
        });
      } catch (e) { console.error("Send deposit mail error:", e); }
    }

    // TĂNG current_guests
    if (isFirstDeposit) {
      const guestsToAdd = (booking.numAdults||0) + (booking.numChildren||0);
      await Tour.updateOne({ _id: booking.tourId }, { $inc: { current_guests: guestsToAdd } });
      const tour = await Tour.findById(booking.tourId);

        if (Number.isFinite(tour.quantity)) {
        if ((tour.current_guests || 0) + guestsToAdd > tour.quantity) {
            return res.status(409).json({ message: "Sold out while paying. Please contact support for refund." });
        }
        }
      if (tour && (tour.current_guests||0) >= (tour.min_guests||0) && tour.status !== "confirmed") {
        tour.status = "confirmed";
        await tour.save();
        await notifyTourConfirmed(tour._id);
      }
    } else {

      if (booking.bookingStatus === "c" && booking.email) {
        try {
          await sendMail({
            to: booking.email,
            subject: `Xác nhận thanh toán đủ - ${booking.code}`,
            html: `<p>Đơn <b>${booking.code}</b> đã thanh toán đủ. Hẹn gặp bạn tại tour!</p>`
          });
        } catch (e) { console.error("Send fully-paid mail error:", e); }
      }
    }

    return res.json({ message: "Payment recorded", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Lịch sử đơn
export const myBookings = async (req, res) => {
  const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);

  const [rows, total] = await Promise.all([
    Booking.find({ userId: req.user.id })
      .populate("tourId", "title destination startDate endDate cover images time priceAdult priceChild")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments({ userId: req.user.id })
  ]);

  res.json({ total, page, limit, data: rows });
};

export const cancelBookingByUser = async (req, res) => {
  const { code } = req.params;
  const bk = await Booking.findOne({ code });
  if (!bk) return res.status(404).json({ message: "Booking not found" });
  if (bk.bookingStatus !== "p") {
    return res.status(400).json({ message: "Only pending bookings can be canceled" });
  }

  bk.bookingStatus = "x";
  await bk.save();

  res.json({ message: "Canceled", booking: bk });
};

export const getMyBookingDetail = async (req, res) => {
  try {
    const { code } = req.params;
    const booking = await Booking.findOne({
      code,
      userId: req.user.id
    })
      .populate("tourId", "title destination startDate endDate images time priceAdult priceChild status itinerary")
      .lean();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({
      code: booking.code,
      status: booking.bookingStatus,
      fullName: booking.fullName,
      email: booking.email,
      phoneNumber: booking.phoneNumber,
      address: booking.address,
      note: booking.note,
      numAdults: booking.numAdults,
      numChildren: booking.numChildren,
      totalPrice: booking.totalPrice,
      paidAmount: booking.paidAmount || 0,
      depositAmount: booking.depositAmount || 0,
      depositPaid: !!booking.depositPaid,
      requireFullPayment: !!booking.requireFullPayment,
      paymentMethod: booking.paymentMethod,
      paymentRefs: booking.paymentRefs || [],
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      tour: booking.tourId ? {
        id: booking.tourId._id,
        title: booking.tourId.title,
        destination: booking.tourId.destination,
        startDate: booking.tourId.startDate,
        endDate: booking.tourId.endDate,
        time: booking.tourId.time,
        status: booking.tourId.status,
        images: booking.tourId.images || [],
        itinerary: booking.tourId.itinerary || []
      } : null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// ADMIN: GET /api/bookings/admin - List all bookings with filters and pagination
export const getAdminBookings = async (req, res) => {
  try {
    console.log("✅ getAdminBookings CALLED with query:", req.query);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const skip = (page - 1) * limit;

    // Build filter - only add if value is provided and not empty
    const filter = {};
    
    // Only apply status filter if it's a valid non-empty value
    if (req.query.status && req.query.status.trim()) {
      filter.bookingStatus = req.query.status;
    }
    
    // Only apply tourId filter if it's a valid ObjectId
    if (req.query.tourId && req.query.tourId.trim() && mongoose.isValidObjectId(req.query.tourId)) {
      filter.tourId = req.query.tourId;
    }

    // Get total count
    const total = await Booking.countDocuments(filter);

    // Get paginated bookings with related data
    const bookings = await Booking.find(filter)
      .populate("tourId", "title destination startDate endDate")
      .populate("userId", "fullName username email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Filter by search (name, email, code) if provided and not empty
    let filteredBookings = bookings;
    if (req.query.search && req.query.search.trim()) {
      const searchLower = req.query.search.toLowerCase();
      filteredBookings = bookings.filter(b =>
        (b.fullName?.toLowerCase().includes(searchLower)) ||
        (b.email?.toLowerCase().includes(searchLower)) ||
        (b.code?.toLowerCase().includes(searchLower)) ||
        (b.phoneNumber?.includes(req.query.search)) ||
        (b.userId?.fullName?.toLowerCase().includes(searchLower))
      );
    }

    console.log("✅ getAdminBookings RETURNING:", { total, page, limit, count: filteredBookings.length });
    res.json({
      total,
      page,
      limit,
      data: filteredBookings || [],
    });
  } catch (err) {
    console.error("❌ getAdminBookings ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: GET /api/bookings/admin/:id - Get single booking
export const getAdminBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("⚠️  getAdminBookingById CALLED with id:", id);

    if (!mongoose.isValidObjectId(id)) {
      console.log("⚠️  Invalid booking ID:", id);
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id)
      .populate("tourId", "title destination startDate endDate priceAdult priceChild")
      .populate("userId", "fullName username email avatarUrl");

    if (!booking) {
      console.log("⚠️  Booking not found for id:", id);
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (err) {
    console.error("❌ getAdminBookingById ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: PATCH /api/bookings/admin/:id/status - Update booking status
export const updateAdminBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    if (!["p", "c", "x"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      { bookingStatus: status },
      { new: true }
    )
      .populate("tourId", "title destination startDate endDate")
      .populate("userId", "fullName username email avatarUrl");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Send notification if confirming
    if (status === "c") {
      try {
        await notifyTourConfirmed(booking.userId._id, booking.tourId._id);
      } catch (err) {
        console.error("Failed to send notification:", err.message);
      }
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: DELETE /api/bookings/admin/:id - Delete a booking
export const deleteAdminBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findByIdAndDelete(id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ message: "Booking deleted successfully", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: GET /api/bookings/admin/code/:code - Get booking by code
export const getAdminBookingByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const booking = await Booking.findOne({ code })
      .populate("tourId", "title destination startDate endDate priceAdult priceChild")
      .populate("userId", "fullName username email avatarUrl");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: PATCH /api/bookings/admin/:id/payment - Update payment status
export const updateAdminBookingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, amount, provider = "manual", ref } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Only allow manual payment updates for COD or manual payment methods
    if (!["cod", "manual"].includes(booking.paymentMethod)) {
      return res.status(400).json({ 
        message: "Payment updates only allowed for COD or manual payment methods" 
      });
    }

    if (action === "mark_paid") {
      const paymentAmount = amount || (booking.totalPrice - (booking.paidAmount || 0));
      
      if (paymentAmount <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }

      // Add payment reference
      booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
      booking.paymentRefs = booking.paymentRefs || [];
      booking.paymentRefs.push({
        provider: provider,
        ref: ref || `ADMIN_${Date.now()}`,
        amount: paymentAmount,
        at: new Date()
      });

      // Mark as deposit paid if not already
      if (!booking.depositPaid && paymentAmount >= (booking.depositAmount || 0)) {
        booking.depositPaid = true;
      }

      // Mark as confirmed if fully paid
      if (booking.paidAmount >= booking.totalPrice) {
        booking.bookingStatus = "c";
      }

      await booking.save();

      res.json({
        message: "Payment updated successfully",
        booking
      });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: POST /api/bookings/admin/bulk/mark-paid - Mark multiple bookings as paid
export const bulkMarkBookingsPaid = async (req, res) => {
  try {
    const { bookingIds, amount, provider = "manual", note } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ message: "Invalid bookingIds array" });
    }

    const validIds = bookingIds.filter(id => mongoose.isValidObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ message: "No valid booking IDs" });
    }

    const bookings = await Booking.find({
      _id: { $in: validIds },
      paymentMethod: { $in: ["cod", "manual"] }
    });

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No eligible bookings found" });
    }

    const updated = [];
    for (const booking of bookings) {
      const paymentAmount = amount || (booking.totalPrice - (booking.paidAmount || 0));
      
      if (paymentAmount <= 0) continue;

      booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
      booking.paymentRefs = booking.paymentRefs || [];
      booking.paymentRefs.push({
        provider: provider,
        ref: `BULK_${Date.now()}_${booking._id}`,
        amount: paymentAmount,
        at: new Date(),
        note
      });

      if (!booking.depositPaid && paymentAmount >= (booking.depositAmount || 0)) {
        booking.depositPaid = true;
      }

      if (booking.paidAmount >= booking.totalPrice) {
        booking.bookingStatus = "c";
      }

      await booking.save();
      updated.push(booking);
    }

    res.json({
      message: `Updated ${updated.length} bookings`,
      count: updated.length,
      bookings: updated
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: POST /api/bookings/admin/:id/refund - Refund a payment
export const refundBookingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundAmount, reason, refundRef } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.paidAmount === 0) {
      return res.status(400).json({ message: "Nothing to refund" });
    }

    const amount = refundAmount || booking.paidAmount;
    if (amount > booking.paidAmount) {
      return res.status(400).json({ message: "Refund amount exceeds paid amount" });
    }

    booking.paidAmount = Math.max(0, booking.paidAmount - amount);
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "refund",
      ref: refundRef || `REFUND_${Date.now()}`,
      amount: -amount,
      at: new Date(),
      note: reason || "Admin refund"
    });

    // Update status if no longer fully paid
    if (booking.paidAmount < booking.totalPrice) {
      booking.bookingStatus = "p";
      booking.depositPaid = booking.paidAmount >= (booking.depositAmount || 0);
    }

    await booking.save();

    res.json({
      message: "Refund processed successfully",
      booking
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: GET /api/bookings/admin/stats/payments - Get payment statistics
export const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$paidAmount" },
          averageAmount: { $avg: "$totalPrice" },
          pendingRevenue: {
            $sum: {
              $cond: [
                { $lt: ["$paidAmount", "$totalPrice"] },
                { $subtract: ["$totalPrice", "$paidAmount"] },
                0
              ]
            }
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    const totalStats = {
      totalBookings: 0,
      totalRevenue: 0,
      pendingRevenue: 0,
      paidBookings: 0,
      unpaidBookings: 0,
      partialPaidBookings: 0
    };

    const bookingStats = await Booking.countDocuments({
      ...filter,
      paidAmount: { $eq: 0 }
    });
    const fullPaidStats = await Booking.countDocuments({
      ...filter,
      paidAmount: { $gte: "$totalPrice" }
    });

    stats.forEach(stat => {
      totalStats.totalBookings += stat.count;
      totalStats.totalRevenue += stat.totalRevenue || 0;
      totalStats.pendingRevenue += stat.pendingRevenue || 0;
    });

    res.json({
      period: { startDate, endDate },
      byPaymentMethod: stats,
      summary: totalStats
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: GET /api/bookings/admin/:id/payment-history - Get payment history for a booking
export const getPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id)
      .select("code paymentMethod paymentRefs paidAmount totalPrice")
      .lean();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({
      booking: {
        id: booking._id,
        code: booking.code,
        paymentMethod: booking.paymentMethod,
        totalPrice: booking.totalPrice,
        paidAmount: booking.paidAmount || 0,
        remaining: (booking.totalPrice || 0) - (booking.paidAmount || 0)
      },
      paymentHistory: booking.paymentRefs || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};