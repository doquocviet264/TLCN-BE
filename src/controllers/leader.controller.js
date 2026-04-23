// src/controllers/leader.controller.js
import mongoose from "mongoose";
import { TourDeparture } from "../models/TourDeparture.js";
import { Expense }       from "../models/Expense.js";
import { Booking }       from "../models/Booking.js";

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
    const dep = await TourDeparture.exists({ _id: id, leaderId: req.user.id });
    if (!dep) return res.status(403).json({ message: "Forbidden (not your departure)" });

    const bookings = await Booking.find({ tourDepartureId: id })
      .populate("userId", "fullName email phoneNumber avatar")
      .select("code userId fullName email phoneNumber numAdults numChildren totalPrice bookingStatus paidAmount depositPaid createdAt")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ total: bookings.length, data: bookings });
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

    const update = {
      $push: {
        timeline: {
          eventType,
          at: atDate,
          place:  place || "",
          note:   note  || "",
          createdBy: new mongoose.Types.ObjectId(req.user.id)
        }
      }
    };

    if (eventType === "departed")  update.$set = { ...(update.$set || {}), status: "in_progress", departedAt: atDate };
    if (eventType === "arrived")   update.$set = { ...(update.$set || {}), arrivedAt: atDate };
    if (eventType === "finished")  update.$set = { ...(update.$set || {}), status: "completed", finishedAt: atDate };

    const departure = await TourDeparture.findOneAndUpdate(
      { _id: id, leaderId: req.user.id }, // ràng buộc sở hữu
      update,
      { new: true }
    );
    if (!departure) return res.status(404).json({ message: "Departure not found or not assigned to you" });

    res.json({ message: "Timeline updated", departure });
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
    const { title, amount, note, visibleToCustomers = true } = req.body;

    if (!title || !Number.isFinite(Number(amount)))
      return res.status(400).json({ message: "title & amount are required" });

    // Chỉ cho phép leader thêm chi phí trên departure của mình
    const dep = await TourDeparture.exists({ _id: id, leaderId: req.user.id });
    if (!dep) return res.status(404).json({ message: "Departure not found or not assigned to you" });

    const expense = await Expense.create({
      tourDepartureId: new mongoose.Types.ObjectId(id),
      title,
      amount:           Number(amount),
      occurredAt:       new Date(),
      note:             note || "",
      visibleToCustomers: Boolean(visibleToCustomers),
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
