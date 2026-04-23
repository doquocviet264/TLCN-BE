// src/controllers/departure.controller.js
import mongoose from "mongoose";
import { TourDeparture } from "../models/TourDeparture.js";
import { Tour }          from "../models/Tour.js";
import { Leader }        from "../models/Leader.js";
import { Expense }       from "../models/Expense.js";

/* ========================================================
 *  1. Tạo lịch khởi hành mới cho 1 Tour Template
 *  POST /api/admin/tours/:tourId/departures
 * ======================================================== */
export const createDeparture = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.isValidObjectId(tourId))
      return res.status(400).json({ message: "Invalid tourId" });

    const tour = await Tour.findById(tourId).select("_id title priceAdult priceChild");
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    const {
      startDate, endDate,
      min_guests, current_guests,
      priceAdult, priceChild,
      status, leaderId
    } = req.body || {};

    if (!startDate || !endDate)
      return res.status(400).json({ message: "startDate & endDate are required" });

    if (leaderId && !mongoose.isValidObjectId(leaderId))
      return res.status(400).json({ message: "Invalid leaderId" });

    const departure = await TourDeparture.create({
      tourId:         new mongoose.Types.ObjectId(tourId),
      startDate:      new Date(startDate),
      endDate:        new Date(endDate),
      min_guests:     min_guests     ?? 10,
      current_guests: current_guests ?? 0,
      priceAdult:     priceAdult  ?? tour.priceAdult,
      priceChild:     priceChild  ?? tour.priceChild,
      status:         status      ?? "pending",
      leaderId:       leaderId    ? new mongoose.Types.ObjectId(leaderId) : null,
    });

    res.status(201).json({ message: "Departure created", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  2. Liệt kê các lịch khởi hành của 1 Tour
 *  GET /api/admin/tours/:tourId/departures
 * ======================================================== */
export const listDepartures = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.isValidObjectId(tourId))
      return res.status(400).json({ message: "Invalid tourId" });

    const { status, page = 1, limit = 50 } = req.query;
    const filter = { tourId: new mongoose.Types.ObjectId(tourId) };
    if (status) filter.status = status;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(parseInt(limit, 10) || 50, 200);

    const [departures, total] = await Promise.all([
      TourDeparture.find(filter)
        .populate("leaderId", "fullName phoneNumber email")
        .sort({ startDate: 1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      TourDeparture.countDocuments(filter)
    ]);

    res.json({ total, page: p, limit: l, data: departures });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  3. Chi tiết 1 Departure
 *  GET /api/admin/departures/:id
 * ======================================================== */
export const getDepartureById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const departure = await TourDeparture.findById(id)
      .populate("tourId",   "title destination images itinerary")
      .populate("leaderId", "fullName phoneNumber email")
      .lean();

    if (!departure) return res.status(404).json({ message: "Departure not found" });
    res.json(departure);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  4. Đổi trạng thái Departure
 *  PATCH /api/admin/departures/:id/status
 * ======================================================== */
export const patchDepartureStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const ALLOWED = ["pending", "confirmed", "in_progress", "completed", "closed"];
    if (!ALLOWED.includes(status))
      return res.status(400).json({ message: `status must be one of: ${ALLOWED.join(", ")}` });

    const departure = await TourDeparture.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!departure) return res.status(404).json({ message: "Departure not found" });

    res.json({ message: "Status updated", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  5. Phân công Leader cho Departure
 *  PATCH /api/admin/departures/:id/leader
 * ======================================================== */
export const assignLeaderToDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    const { leaderId } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    if (leaderId !== null && leaderId !== undefined && !mongoose.isValidObjectId(leaderId))
      return res.status(400).json({ message: "Invalid leaderId" });

    // Nếu leaderId = null → gỡ leader
    let update;
    if (leaderId) {
      const leader = await Leader.findById(leaderId);
      if (!leader) return res.status(404).json({ message: "Leader not found" });
      update = { leaderId: leader._id };
    } else {
      update = { leaderId: null };
    }

    const departure = await TourDeparture.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).populate("leaderId", "fullName phoneNumber email");

    if (!departure) return res.status(404).json({ message: "Departure not found" });
    res.json({ message: "Leader assigned", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  6. Thêm Timeline Event vào Departure (Admin)
 *  POST /api/admin/departures/:id/timeline
 * ======================================================== */
export const addTimelineToDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventType, at, place, note } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const ALLOWED = ["departed", "arrived", "checkpoint", "note", "finished"];
    if (!ALLOWED.includes(eventType))
      return res.status(400).json({ message: "Invalid eventType" });

    const atDate = at ? new Date(at) : new Date();
    if (isNaN(atDate.getTime()))
      return res.status(400).json({ message: "Invalid 'at' datetime" });

    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id))
      return res.status(401).json({ message: "Invalid admin ID" });

    const event = {
      eventType,
      at: atDate,
      place: place || "",
      note:  note  || "",
      createdBy: new mongoose.Types.ObjectId(req.user.id)
    };

    const update = { $push: { timeline: event } };
    if (eventType === "departed")  update.$set = { ...(update.$set || {}), departedAt: atDate, status: "in_progress" };
    if (eventType === "arrived")   update.$set = { ...(update.$set || {}), arrivedAt: atDate };
    if (eventType === "finished")  update.$set = { ...(update.$set || {}), finishedAt: atDate, status: "completed" };

    const departure = await TourDeparture.findByIdAndUpdate(id, update, { new: true });
    if (!departure) return res.status(404).json({ message: "Departure not found" });

    res.json({ message: "Timeline updated", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  7. Thêm Chi Phí cho Departure (Admin)
 *  POST /api/admin/departures/:id/expenses
 * ======================================================== */
export const createExpenseForDeparture = async (req, res) => {
  try {
    const { id } = req.params; // departureId
    const { title, amount, note, visibleToCustomers = true } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });
    if (!title || !Number.isFinite(Number(amount)))
      return res.status(400).json({ message: "title & amount are required" });
    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id))
      return res.status(401).json({ message: "Invalid admin ID" });

    // Kiểm tra departure tồn tại
    const dep = await TourDeparture.exists({ _id: id });
    if (!dep) return res.status(404).json({ message: "Departure not found" });

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
 *  8. Danh Sách Chi Phí của Departure
 *  GET /api/admin/departures/:id/expenses
 * ======================================================== */
export const listExpensesForDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const items = await Expense.find({ tourDepartureId: id })
      .sort({ occurredAt: 1, _id: 1 })
      .lean();

    const total = items.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ total, count: items.length, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  9. Danh sách Ongoing Departures (thay thế listOngoingTours cũ)
 *  GET /api/admin/departures/ongoing
 * ======================================================== */
export const listOngoingDepartures = async (req, res) => {
  try {
    const now = new Date();
    const onlyToday = String(req.query.onlyToday || "0") === "1";

    const filter = { status: { $in: ["confirmed", "in_progress"] } };
    if (onlyToday) {
      filter.startDate = { $lte: now };
      filter.endDate   = { $gte: now };
    }

    const data = await TourDeparture.find(filter)
      .populate("tourId",   "title destination")
      .populate("leaderId", "fullName phoneNumber")
      .select("tourId startDate endDate status leaderId current_guests min_guests departedAt arrivedAt finishedAt")
      .sort({ startDate: 1 })
      .lean();

    res.json({ total: data.length, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
