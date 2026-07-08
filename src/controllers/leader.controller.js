// src/controllers/leader.controller.js
import mongoose from "mongoose";
import { TourDeparture } from "../models/TourDeparture.js";
import { Expense }       from "../models/Expense.js";
import { Booking }       from "../models/Booking.js";
import { Leader }        from "../models/Leader.js";
import { unlockProvinceForDeparture } from "../services/journey.service.js";

const CANCELLED_BOOKING_STATUSES = ["cancelled", "x"];

const toObjectIds = (ids = []) =>
  ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

/* ========================================================
 *  0. Thông tin Leader hiện tại
 *  GET /api/leader/me
 * ======================================================== */
export const leaderGetMe = async (req, res) => {
  try {
    const leader = await Leader.findById(req.user.id)
      .select("_id username fullName email phoneNumber address status createdAt")
      .lean();

    if (!leader) return res.status(404).json({ message: "Leader not found" });
    if (leader.status !== "active") return res.status(403).json({ message: "Leader inactive" });

    res.json({
      id: String(leader._id),
      username: leader.username,
      fullName: leader.fullName,
      email: leader.email,
      phoneNumber: leader.phoneNumber,
      address: leader.address,
      status: leader.status,
      createdAt: leader.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  1. Danh sách Departure được phân công cho Leader
 *  GET /api/leader/departures
 * ======================================================== */
export const leaderMyTours = async (req, res) => {
  try {
    const { status, onlyToday } = req.query;
    const filter = { leaderId: new mongoose.Types.ObjectId(req.user.id) };

    if (status) filter.status = status;
    if (onlyToday === "1") {
      const now = new Date();
      filter.startDate = { $lte: now };
      filter.endDate   = { $gte: now };
    }

    const departures = await TourDeparture.find(filter)
      .populate("tourId", "title destination destinationSlug images itinerary includes excludes")
      .sort({ startDate: 1 })
      .lean();

    res.json(departures);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  2. Chi tiết 1 Departure
 *  GET /api/leader/departures/:id
 * ======================================================== */
export const leaderGetDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const departure = await TourDeparture.findOne({ _id: id, leaderId: req.user.id })
      .populate("tourId", "title destination destinationSlug images itinerary includes excludes priceAdult priceChild")
      .lean();

    if (!departure) return res.status(404).json({ message: "Departure not found or not assigned to you" });
    res.json(departure);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  3. Danh sách hành khách (Booking) của 1 Departure
 *  GET /api/leader/departures/:id/passengers
 * ======================================================== */
export const leaderGetPassengers = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    // Kiểm tra leader có sở hữu departure này không
    const dep = await TourDeparture.findOne({ _id: id, leaderId: req.user.id }).select("passengerCheckins");
    if (!dep) return res.status(403).json({ message: "Forbidden (not your departure)" });

    const bookings = await Booking.find({
      tourDepartureId: id,
      bookingStatus: { $nin: CANCELLED_BOOKING_STATUSES },
    })
      .populate("userId", "fullName email phoneNumber avatar")
      .select("code userId fullName email phoneNumber numAdults numChildren totalPrice bookingStatus paidAmount depositPaid createdAt note")
      .sort({ createdAt: 1 })
      .lean();

    // Map isPresent từ TourDeparture vào Booking
    const checkinMap = new Map();
    if (dep.passengerCheckins) {
      for (const ci of dep.passengerCheckins) {
        checkinMap.set(ci.bookingId.toString(), ci.isPresent);
      }
    }

    const data = bookings.map(b => ({
      ...b,
      isPresent: checkinMap.get(b._id.toString()) || false
    }));

    res.json({ total: data.length, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  3b. Điểm danh hành khách (Booking level)
 *  PATCH /api/leader/departures/:id/bookings/:bookingId/checkin
 * ======================================================== */
export const leaderUpdateBookingCheckin = async (req, res) => {
  try {
    const { id, bookingId } = req.params;
    const { isPresent } = req.body;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const dep = await TourDeparture.findOne({ _id: id, leaderId: req.user.id });
    if (!dep) return res.status(404).json({ message: "Departure not found or not yours" });

    const booking = await Booking.exists({
      _id: bookingId,
      tourDepartureId: id,
      bookingStatus: { $nin: CANCELLED_BOOKING_STATUSES },
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found in this departure" });
    }

    dep.passengerCheckins = dep.passengerCheckins || [];

    const existingCheckinIndex = dep.passengerCheckins.findIndex(
      ci => ci.bookingId.toString() === bookingId
    );

    if (existingCheckinIndex > -1) {
      dep.passengerCheckins[existingCheckinIndex].isPresent = isPresent;
      dep.passengerCheckins[existingCheckinIndex].checkedAt = new Date();
      dep.passengerCheckins[existingCheckinIndex].checkedBy = new mongoose.Types.ObjectId(req.user.id);
    } else {
      dep.passengerCheckins.push({
        bookingId: new mongoose.Types.ObjectId(bookingId),
        isPresent,
        checkedAt: new Date(),
        checkedBy: new mongoose.Types.ObjectId(req.user.id),
      });
    }

    await dep.save();
    res.json({ message: "Checkin updated", isPresent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  4. Thêm Timeline Event
 *  PATCH /api/leader/departures/:id/timeline
 * ======================================================== */
export const leaderAddTimeline = async (req, res) => {
  try {
    const { id } = req.params; // departureId
    const { eventType, at, place, note } = req.body;

    const ALLOWED = ["departed", "arrived", "checkpoint", "note", "finished"];
    if (!ALLOWED.includes(eventType))
      return res.status(400).json({ message: "Invalid eventType" });

    const atDate = at ? new Date(at) : new Date();
    if (isNaN(atDate.getTime()))
      return res.status(400).json({ message: "Invalid 'at' datetime" });

    const currentDep = await TourDeparture.findOne({ _id: id, leaderId: req.user.id });
    if (!currentDep) return res.status(404).json({ message: "Departure not found or not assigned to you" });

    if (eventType !== "departed" && !["in_progress", "completed"].includes(currentDep.status)) {
      return res.status(400).json({ message: "Chuyến đi chưa xuất phát, không thể thêm sự kiện này!" });
    }

    const update = {
      $push: {
        timeline: {
          eventType,
          at: atDate,
          place:  place || "",
          note:   note  || "",
          createdBy: new mongoose.Types.ObjectId(req.user.id),
          createdByRole: "leader"
        }
      }
    };

    if (eventType === "departed")  update.$set = { ...(update.$set || {}), status: "in_progress", departedAt: atDate };
    if (eventType === "arrived")   update.$set = { ...(update.$set || {}), arrivedAt: atDate };
    if (eventType === "finished")  update.$set = { ...(update.$set || {}), status: "completed", finishedAt: atDate };

    const departure = await TourDeparture.findByIdAndUpdate(
      id,
      update,
      { new: true }
    );

    let completedBookings = null;
    if (eventType === "finished") {
      completedBookings = await Booking.updateMany(
        { tourDepartureId: id, bookingStatus: "confirmed" },
        { $set: { bookingStatus: "completed" } }
      );
      await unlockProvinceForDeparture(id);
    }

    res.json({ message: "Timeline updated", departure, completedBookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  5. Leader Tạo Chi Phí Phát Sinh
 *  POST /api/leader/departures/:id/expenses
 * ======================================================== */
export const leaderCreateExpense = async (req, res) => {
  try {
    const { id } = req.params; // departureId
    const { title, amount, note, visibleToCustomers = true, receiptImages = [] } = req.body;

    if (!title || !Number.isFinite(Number(amount)))
      return res.status(400).json({ message: "title & amount are required" });

    const normalizedReceiptImages = Array.isArray(receiptImages)
      ? receiptImages.filter((url) => typeof url === "string" && url.trim()).slice(0, 5)
      : [];

    // Chỉ cho phép leader thêm chi phí trên departure của mình
    const dep = await TourDeparture.findOne({ _id: id, leaderId: req.user.id });
    if (!dep) return res.status(404).json({ message: "Departure not found or not assigned to you" });

    if (!["in_progress", "completed"].includes(dep.status)) {
      return res.status(400).json({ message: "Chuyến đi chưa xuất phát, không thể thêm chi phí phát sinh!" });
    }

    const expense = await Expense.create({
      tourDepartureId: new mongoose.Types.ObjectId(id),
      title,
      amount:           Number(amount),
      occurredAt:       new Date(),
      note:             note || "",
      receiptImages:    normalizedReceiptImages,
      visibleToCustomers: Boolean(visibleToCustomers),
      status:           "pending",
      addedBy:          new mongoose.Types.ObjectId(req.user.id)
    });

    res.status(201).json({ message: "Expense created", expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  6. Danh sách chi phí của 1 Departure (Leader view)
 *  GET /api/leader/departures/:id/expenses
 * ======================================================== */
export const leaderGetExpenses = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    // Kiểm tra quyền
    const dep = await TourDeparture.exists({ _id: id, leaderId: req.user.id });
    if (!dep) return res.status(403).json({ message: "Forbidden (not your departure)" });

    const expenses = await Expense.find({ tourDepartureId: id })
      .sort({ occurredAt: 1 })
      .lean();

    const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ total: totalAmount, count: expenses.length, data: expenses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  7. Danh sách khách đã đặt tour (với format cho chat)
 *  GET /api/leader/tours/:id/bookings
 * ======================================================== */
export const leaderGetTourBookings = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    // Kiểm tra leader có sở hữu departure này không
    const departure = await TourDeparture.findOne({ _id: id, leaderId: req.user.id })
      .populate("tourId", "title")
      .lean();
    if (!departure) return res.status(403).json({ message: "Forbidden (not your departure)" });

    const bookings = await Booking.find({
      tourDepartureId: id,
      bookingStatus: { $nin: CANCELLED_BOOKING_STATUSES },
    })
      .populate("userId", "fullName email phoneNumber avatar")
      .select("code userId fullName email phoneNumber numAdults numChildren totalPrice bookingStatus paidAmount depositPaid createdAt")
      .sort({ createdAt: 1 })
      .lean();

    // Format theo cấu trúc frontend cần
    const formattedBookings = bookings.map(b => ({
      _id: b._id,
      code: b.code,
      userId: b.userId?._id?.toString(),
      customerName: b.userId?.fullName || b.fullName || "Khách hàng",
      customerEmail: b.userId?.email || b.email,
      customerPhone: b.userId?.phoneNumber || b.phoneNumber,
      customerAvatar: b.userId?.avatar || null,
      guestCount: (b.numAdults || 0) + (b.numChildren || 0),
      totalPrice: b.totalPrice,
      bookingStatus: b.bookingStatus,
      paymentStatus: b.depositPaid ? "paid" : "pending",
      createdAt: b.createdAt,
    }));

    res.json({
      tourId: id,
      tourTitle: departure.tourId?.title || "Tour",
      total: formattedBookings.length,
      data: formattedBookings
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  8. Leader nộp báo cáo sau tour
 *  PATCH /api/leader/departures/:id/report
 * ======================================================== */
export const leaderSubmitTourReport = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      summary = "",
      incidents = "",
      expenseNote = "",
      noShowBookingIds = [],
    } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid departure ID" });
    }

    if (!summary.trim()) {
      return res.status(400).json({ message: "summary is required" });
    }

    const dep = await TourDeparture.findOne({ _id: id, leaderId: req.user.id })
      .select("_id status")
      .lean();
    if (!dep) return res.status(404).json({ message: "Departure not found or not assigned to you" });
    if (dep.status !== "completed" && dep.status !== "closed") {
      return res.status(400).json({ message: "Chuyến đi phải hoàn thành mới có thể nộp báo cáo" });
    }

    const requestedNoShows = Array.isArray(noShowBookingIds)
      ? toObjectIds(noShowBookingIds)
      : [];

    const validNoShows = requestedNoShows.length
      ? await Booking.find({
          _id: { $in: requestedNoShows },
          tourDepartureId: id,
          bookingStatus: { $nin: CANCELLED_BOOKING_STATUSES },
        }).select("_id").lean()
      : [];

    const report = {
      summary: summary.trim(),
      incidents: incidents.trim(),
      expenseNote: expenseNote.trim(),
      noShowBookingIds: validNoShows.map((b) => b._id),
      status: "submitted",
      submittedAt: new Date(),
      submittedBy: new mongoose.Types.ObjectId(req.user.id),
      reviewNote: "",
    };

    const departure = await TourDeparture.findOneAndUpdate(
      { _id: id, leaderId: req.user.id },
      { $set: { leaderReport: report } },
      { new: true }
    ).populate("tourId", "title destination destinationSlug images itinerary includes excludes priceAdult priceChild");

    res.json({ message: "Report submitted", report: departure.leaderReport, departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
