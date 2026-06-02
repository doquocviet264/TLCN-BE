// src/controllers/admin.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";      // ⬅️ dùng khi gán leaderId
import { Tour } from "../models/Tour.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Expense } from "../models/Expense.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { BlogPost } from "../models/BlogPost.js";
import cloudinary from "../config/cloudinary.js";
import { unlockProvinceForDeparture } from "../services/journey.service.js";

/* ===========================
 *  AUTH: ADMIN LOGIN (JWT)
 * =========================== */
export const adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier & password are required" });
    }

    const find = identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { username: identifier };

    const admin = await Admin.findOne(find);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const ok = await bcrypt.compare(password, admin.password || "");
    if (!ok) return res.status(400).json({ message: "Wrong password" });

    // ⬅️ THỐNG NHẤT: payload dùng role = "admin"
    const token = jwt.sign(
      { id: String(admin._id), role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({
      message: "Admin login success",
      token,
      admin: {
        id: String(admin._id),
        fullName: admin.fullName,
        email: admin.email,
        username: admin.username,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ====================================
 *  DASHBOARD STATS
 * ==================================== */
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Parallel queries for better performance
    const [
      totalUsers,
      totalTours,
      totalBookings,
      totalReviews,
      totalBlogs,
      activeTours,
      monthlyBookings,
      yearlyRevenue,
      recentBookings,
      popularTours,
      averageRating,
      // New stats
      monthlyRevenueData,
      monthlyBookingsData,
      topDestinations,
      bookingStatusData,
      topRevenueTours,
      newUsersThisMonth
    ] = await Promise.all([
      // Basic counts
      User.countDocuments({ status: 'y' }),
      Tour.countDocuments(),
      Booking.countDocuments(),
      Review.countDocuments(),
      BlogPost.countDocuments(),

      // Active departures (confirmed + in_progress)
      TourDeparture.countDocuments({ status: { $in: ['confirmed', 'in_progress'] } }),

      // Monthly bookings
      Booking.countDocuments({
        createdAt: { $gte: startOfMonth },
        bookingStatus: { $ne: 'x' }
      }),

      // Yearly revenue
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfYear },
            bookingStatus: 'c'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' }
          }
        }
      ]),

      // Recent bookings
      Booking.find({ bookingStatus: { $ne: 'x' } })
        .populate('userId', 'fullName email')
        .populate('tourDepartureId', 'startDate endDate status')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Popular tours (most bookings)
      Booking.aggregate([
        { $match: { bookingStatus: { $ne: 'x' } } },
        {
          $group: {
            _id: '$tourDepartureId',
            bookingCount: { $sum: 1 },
            totalGuests: { $sum: { $add: ['$numAdults', '$numChildren'] } }
          }
        },
        { $sort: { bookingCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'tbl_tour_departures',
            localField: '_id',
            foreignField: '_id',
            as: 'departure'
          }
        },
        { $unwind: '$departure' },
        {
          $lookup: {
            from: 'tbl_tours',
            localField: 'departure.tourId',
            foreignField: '_id',
            as: 'tour'
          }
        },
        { $unwind: { path: '$tour', preserveNullAndEmptyArrays: true } }
      ]),

      // Average rating
      Review.aggregate([
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' }
          }
        }
      ]),

      // Monthly revenue chart (12 months of current year)
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfYear },
            bookingStatus: 'c'
          }
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            revenue: { $sum: '$totalPrice' },
            bookings: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Monthly bookings chart (12 months)
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfYear },
            bookingStatus: { $ne: 'x' }
          }
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            count: { $sum: 1 },
            guests: { $sum: { $add: ['$numAdults', '$numChildren'] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Top destinations by booking count
      Booking.aggregate([
        { $match: { bookingStatus: { $ne: 'x' } } },
        {
          $lookup: {
            from: 'tbl_tour_departures',
            localField: 'tourDepartureId',
            foreignField: '_id',
            as: 'departure'
          }
        },
        { $unwind: { path: '$departure', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'tbl_tours',
            localField: 'departure.tourId',
            foreignField: '_id',
            as: 'tour'
          }
        },
        { $unwind: { path: '$tour', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$tour.destination',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalPrice' },
            guests: { $sum: { $add: ['$numAdults', '$numChildren'] } }
          }
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { bookings: -1 } },
        { $limit: 6 }
      ]),

      // Booking status statistics with revenue
      Booking.aggregate([
        {
          $group: {
            _id: '$bookingStatus',
            count: { $sum: 1 },
            revenue: { $sum: '$totalPrice' }
          }
        }
      ]),

      // Top revenue tours
      Booking.aggregate([
        { $match: { bookingStatus: 'c' } },
        {
          $lookup: {
            from: 'tbl_tour_departures',
            localField: 'tourDepartureId',
            foreignField: '_id',
            as: 'departure'
          }
        },
        { $unwind: { path: '$departure', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'tbl_tours',
            localField: 'departure.tourId',
            foreignField: '_id',
            as: 'tour'
          }
        },
        { $unwind: { path: '$tour', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$tour._id',
            title: { $first: '$tour.title' },
            destination: { $first: '$tour.destination' },
            revenue: { $sum: '$totalPrice' },
            bookings: { $sum: 1 }
          }
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]),

      // New users this month
      User.countDocuments({
        createdAt: { $gte: startOfMonth },
        status: 'y'
      })
    ]);

    // Format monthly revenue for chart (fill all 12 months)
    const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const monthlyRevenue = monthNames.map((month, index) => {
      const data = monthlyRevenueData.find(d => d._id === index + 1);
      return {
        month,
        monthIndex: index + 1,
        revenue: data?.revenue || 0,
        bookings: data?.bookings || 0
      };
    });

    // Format monthly bookings for chart
    const monthlyBookingsChart = monthNames.map((month, index) => {
      const data = monthlyBookingsData.find(d => d._id === index + 1);
      return {
        month,
        monthIndex: index + 1,
        count: data?.count || 0,
        guests: data?.guests || 0
      };
    });

    // Format booking status stats
    const bookingStatusStats = {
      confirmed: { count: 0, revenue: 0 },
      pending: { count: 0, revenue: 0 },
      cancelled: { count: 0, revenue: 0 }
    };
    bookingStatusData.forEach(item => {
      if (item._id === 'c') {
        bookingStatusStats.confirmed = { count: item.count, revenue: item.revenue };
      } else if (item._id === 'p') {
        bookingStatusStats.pending = { count: item.count, revenue: item.revenue };
      } else if (item._id === 'x') {
        bookingStatusStats.cancelled = { count: item.count, revenue: item.revenue };
      }
    });

    // Format stats
    const stats = {
      overview: {
        totalUsers,
        totalTours,
        totalBookings,
        totalReviews,
        totalBlogs,
        activeTours,
        monthlyBookings,
        yearlyRevenue: yearlyRevenue[0]?.total || 0,
        averageRating: averageRating[0]?.avgRating || 0,
        newUsersThisMonth
      },
      recentBookings: recentBookings.map(booking => ({
        _id: booking._id,
        userInfo: booking.userId ? {
          fullName: booking.userId.fullName,
          email: booking.userId.email
        } : { fullName: booking.fullName, email: booking.email },
        tourInfo: booking.tourId ? {
          title: booking.tourId.title,
          destination: booking.tourId.destination
        } : null,
        totalPrice: booking.totalPrice,
        numGuests: booking.numAdults + booking.numChildren,
        bookingStatus: booking.bookingStatus,
        createdAt: booking.createdAt
      })),
      popularTours: popularTours.map(item => ({
        _id: item._id,
        title: item.tour?.title,
        destination: item.tour?.destination,
        bookingCount: item.bookingCount,
        totalGuests: item.totalGuests
      })),
      statusDistribution: {
        pending: 0,
        confirmed: 0,
        inProgress: 0,
        completed: 0,
        closed: 0
      },
      // New chart data
      monthlyRevenue,
      monthlyBookingsChart,
      topDestinations: topDestinations.map(d => ({
        name: d._id,
        bookings: d.bookings,
        revenue: d.revenue,
        guests: d.guests
      })),
      bookingStatusStats,
      topRevenueTours: topRevenueTours.map(t => ({
        _id: t._id,
        title: t.title,
        destination: t.destination,
        revenue: t.revenue,
        bookings: t.bookings
      }))
    };

    // Get departure status distribution (status now lives on TourDeparture)
    const statusCounts = await TourDeparture.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    statusCounts.forEach(item => {
      if (item._id === 'pending') stats.statusDistribution.pending = item.count;
      else if (item._id === 'confirmed') stats.statusDistribution.confirmed = item.count;
      else if (item._id === 'in_progress') stats.statusDistribution.inProgress = item.count;
      else if (item._id === 'completed') stats.statusDistribution.completed = item.count;
      else if (item._id === 'closed') stats.statusDistribution.closed = item.count;
    });

    res.json(stats);
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const listOngoingTours = async (req, res) => {
  try {
    const now = new Date();
    const onlyToday = String(req.query.onlyToday || "0") === "1";

    const filter = { status: { $in: ["confirmed", "in_progress"] } };
    if (onlyToday) {
      filter.startDate = { $lte: now };
      filter.endDate   = { $gte: now };
    }

    // Status now lives on TourDeparture
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

/* ====================================
 *  B) GÁN/CẬP NHẬT LEADER CHO TOUR
 *  - Cho phép gán leaderId (tham chiếu Leader)
 *  - Đồng thời snapshot leader(fullName, phoneNumber, note)
 * ==================================== */
/**
 * @deprecated Use departure.controller.js assignLeaderToDeparture instead.
 * Kept for backward compat – now tries to update TourDeparture if departureId provided,
 * fallback to old Tour update behaviour.
 */
export const updateLeader = async (req, res) => {
  try {
    const { id } = req.params;                   // departureId or tourId
    const { leaderId, fullName, phoneNumber, note } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const update = {};

    if (leaderId) {
      if (!mongoose.isValidObjectId(leaderId)) {
        return res.status(400).json({ message: "Invalid leaderId" });
      }
      const leader = await Leader.findById(leaderId);
      if (!leader) return res.status(404).json({ message: "Leader not found" });
      update.leaderId = leader._id;
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No changes" });
    }

    // Thử update TourDeparture trước
    const departure = await TourDeparture.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
    if (departure) return res.json({ message: "Leader updated", departure });

    // Fallback: cũ (nếu id là tourId)
    const tour = await Tour.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!tour) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Leader updated", tour });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ====================================
 *  C) THÊM SỰ KIỆN TIMELINE (ADMIN)
 *  - Đảm bảo createdBy là ObjectId
 *  - Cập nhật trạng thái theo eventType
 * ==================================== */
export const addTimelineEvent = async (req, res) => {
  try {
    const { id } = req.params;                   // departureId
    const { eventType, at, place, note } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid departure ID" });
    }

    const ALLOWED = ["departed", "arrived", "checkpoint", "note", "finished"];
    if (!ALLOWED.includes(eventType)) {
      return res.status(400).json({ message: "Invalid eventType" });
    }

    const atDate = at ? new Date(at) : new Date();
    if (isNaN(atDate.getTime())) {
      return res.status(400).json({ message: "Invalid 'at' datetime" });
    }

    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id)) {
      return res.status(401).json({ message: "Invalid admin ID" });
    }

    const event = {
      eventType,
      at: atDate,
      place: place || "",
      note: note || "",
      createdBy: new mongoose.Types.ObjectId(req.user.id)
    };

    const update = { $push: { timeline: event } };

    if (eventType === "departed") {
      update.$set = { ...(update.$set || {}), departedAt: atDate, status: "in_progress" };
    }
    if (eventType === "arrived") {
      update.$set = { ...(update.$set || {}), arrivedAt: atDate };
    }
    if (eventType === "finished") {
      update.$set = { ...(update.$set || {}), finishedAt: atDate, status: "completed" };
    }

    // Update TourDeparture (status/timeline đã chuyển sang đây)
    const departure = await TourDeparture.findByIdAndUpdate(id, update, { new: true });
    if (!departure) return res.status(404).json({ message: "Departure not found" });

    // Khi lịch trình kết thúc, tự động cập nhật các booking 'confirmed' sang 'completed'
    if (eventType === "finished") {
      await Booking.updateMany(
        { tourDepartureId: id, bookingStatus: "confirmed" },
        { $set: { bookingStatus: "completed" } }
      );
      await unlockProvinceForDeparture(id);
    }

    res.json({ message: "Timeline updated", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ====================================
 *  D) CHI PHÍ PHÁT SINH (CRUD - ADMIN)
 *  - occurredAt = thời gian hiện tại server
 *  - addedBy = admin ObjectId
 *  - chặn sửa occurredAt/addedBy khi update
 * ==================================== */
export const createExpense = async (req, res) => {
  try {
    const { id } = req.params; // departureId
    const { title, amount, note, visibleToCustomers = true } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid departure ID" });
    }
    if (!title || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ message: "title & amount are required" });
    }
    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id)) {
      return res.status(401).json({ message: "Invalid admin ID" });
    }

    const expense = await Expense.create({
      tourDepartureId: new mongoose.Types.ObjectId(id),
      title,
      amount: Number(amount),
      occurredAt: new Date(),
      note: note || "",
      visibleToCustomers: Boolean(visibleToCustomers),
      addedBy: new mongoose.Types.ObjectId(req.user.id)
    });

    res.status(201).json({ message: "Expense created", expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listExpensesAdmin = async (req, res) => {
  try {
    const { id } = req.params; // departureId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid departure ID" });
    }
    const items = await Expense.find({ tourDepartureId: id })
      .sort({ occurredAt: 1, _id: 1 })
      .lean();

    const total = items.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ total, count: items.length, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    if (!mongoose.isValidObjectId(expenseId)) {
      return res.status(400).json({ message: "Invalid expenseId" });
    }

    // Không cho phép đổi occurredAt / addedBy
    const body = { ...req.body };
    delete body.occurredAt;
    delete body.addedBy;

    const e = await Expense.findByIdAndUpdate(expenseId, body, { new: true });
    if (!e) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Expense updated", expense: e });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    if (!mongoose.isValidObjectId(expenseId)) {
      return res.status(400).json({ message: "Invalid expenseId" });
    }

    const e = await Expense.findByIdAndDelete(expenseId);
    if (!e) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ====================================
 *  CRUD TOURS FOR ADMIN
 * ==================================== */

// GET all tours (with filters)
export const getAllTours = async (req, res) => {
  try {
    const { page = 1, limit = 20, destination, search, time, status } = req.query;
    
    const filter = {};
    if (status) {
      filter.status = status;
    } else {
      // Mặc định ẩn các tour đã xóa mềm
      filter.status = { $ne: 'deleted' };
    }
    
    if (destination) filter.destinationSlug = new RegExp(destination
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/\s+/g," ").trim(), "i");
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { destination: { $regex: search, $options: "i" } }
      ];
    }
    if (time && time.trim()) {
      filter.time = { $regex: time.trim(), $options: "i" };
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(parseInt(limit, 10) || 20, 100);

    const [data, total] = await Promise.all([
      Tour.find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Tour.countDocuments(filter)
    ]);

    res.json({ total, page: p, limit: l, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET distinct tour time values (for dropdown)
export const getTourTimes = async (req, res) => {
  try {
    const times = await Tour.distinct("time");
    // Lọc bỏ null/empty, sắp xếp
    const filtered = times
      .filter(t => t && t.trim())
      .sort();
    res.json({ data: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single tour by ID
export const getTourByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tour ID" });
    }

    const tour = await Tour.findById(id).lean();
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    res.json(tour);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CREATE new tour
export const createTourAdmin = async (req, res) => {
  try {
    let tourData = req.body;

    // Handle multipart/form-data (when files are present)
    if (req.body.data) {
      try {
        tourData = JSON.parse(req.body.data);
      } catch (e) {
        return res.status(400).json({ message: "Invalid JSON in data field" });
      }
    }

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      const folder = process.env.CLOUDINARY_FOLDER || "travela/tours";
      
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image", overwrite: true },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          stream.end(file.buffer);
        });

        const url = uploadResult.secure_url;
        const fieldName = file.fieldname;

        // Pattern matching for keys: 
        // 1. main_image_index
        // 2. item_image_dayIdx_segIdx_itemIdx
        
        if (fieldName.startsWith("main_image_")) {
          const idx = parseInt(fieldName.split("_")[2]);
          if (!Array.isArray(tourData.images)) tourData.images = [];
          tourData.images[idx] = url;
        } else if (fieldName.startsWith("item_image_")) {
           const parts = fieldName.split("_"); // ["item", "image", dayIdx, segIdx, itemIdx]
           const d = parseInt(parts[2]);
           const s = parseInt(parts[3]);
           const i = parseInt(parts[4]);
           
           if (tourData.itinerary?.[d]?.segments?.[s]?.items?.[i]) {
             const item = tourData.itinerary[d].segments[s].items[i];
             if (typeof item === 'string') {
               tourData.itinerary[d].segments[s].items[i] = { text: item, imageUrl: url };
             } else {
               tourData.itinerary[d].segments[s].items[i].imageUrl = url;
             }
           }
        }
      }
    }

    // Filter main images (remove empty/null)
    if (Array.isArray(tourData.images)) {
      tourData.images = tourData.images.filter(img => !!img);
    }

    // Validate required fields
    if (!tourData.title || !tourData.destination) {
      return res.status(400).json({ message: "Title and destination are required" });
    }

    // Set default images if not provided
    if (!Array.isArray(tourData.images)) tourData.images = [];
    if (tourData.images.length < 5) {
      const base = (tourData.destination || "tour")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, "-");
      while (tourData.images.length < 5) {
        tourData.images.push(`/images/${base}/${tourData.images.length + 1}.jpg`);
      }
    }

    const newTour = await Tour.create(tourData);
    
    console.log(`✅ Admin created tour: ${newTour.title} (ID: ${newTour._id})`);
    
    res.status(201).json({
      message: "Tour created successfully",
      tour: newTour
    });
  } catch (err) {
    console.error("❌ Error creating tour:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// UPDATE tour
export const updateTourAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tour ID" });
    }

    let updateData = req.body;

    // Handle multipart/form-data (when files are present)
    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
      } catch (e) {
        return res.status(400).json({ message: "Invalid JSON in data field" });
      }
    }

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      const folder = process.env.CLOUDINARY_FOLDER || "travela/tours";
      
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image", overwrite: true },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          stream.end(file.buffer);
        });

        const url = uploadResult.secure_url;
        const fieldName = file.fieldname;

        if (fieldName.startsWith("main_image_")) {
          const idx = parseInt(fieldName.split("_")[2]);
          if (!Array.isArray(updateData.images)) updateData.images = [];
          updateData.images[idx] = url;
        } else if (fieldName.startsWith("item_image_")) {
           const parts = fieldName.split("_");
           const d = parseInt(parts[2]);
           const s = parseInt(parts[3]);
           const i = parseInt(parts[4]);
           
           if (updateData.itinerary?.[d]?.segments?.[s]?.items?.[i]) {
             const item = updateData.itinerary[d].segments[s].items[i];
             if (typeof item === 'string') {
               updateData.itinerary[d].segments[s].items[i] = { text: item, imageUrl: url };
             } else {
               updateData.itinerary[d].segments[s].items[i].imageUrl = url;
             }
           }
        }
      }
    }

    // Filter main images (remove empty/null)
    if (Array.isArray(updateData.images)) {
      updateData.images = updateData.images.filter(img => !!img);
    }

    // Handle images - ensure minimum 5 images
    if (Array.isArray(updateData.images) && updateData.images.length < 5) {
      const base = (updateData.destination || updateData.destinationSlug || "tour")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, "-");
      while (updateData.images.length < 5) {
        updateData.images.push(`/images/${base}/${updateData.images.length + 1}.jpg`);
      }
    }

    const updatedTour = await Tour.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    console.log(`✅ Admin updated tour: ${updatedTour.title} (ID: ${updatedTour._id})`);

    res.json({
      message: "Tour updated successfully",
      tour: updatedTour
    });
  } catch (err) {
    console.error("❌ Error updating tour:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// DELETE tour
export const deleteTourAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tour ID" });
    }

    const deletedTour = await Tour.findByIdAndUpdate(
      id,
      { status: "deleted" },
      { new: true }
    );

    if (!deletedTour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    console.log(`🗑️  Admin deleted tour: ${deletedTour.title} (ID: ${deletedTour._id})`);

    res.json({
      message: "Tour deleted successfully",
      tour: deletedTour
    });
  } catch (err) {
    console.error("❌ Error deleting tour:", err.message);
    res.status(500).json({ message: err.message });
  }
};


// ==================== ADMIN LEADER MANAGEMENT ====================

// ADMIN: GET /api/admin/leaders - List all leaders
export const getAdminLeaders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Get total count
    const total = await Leader.countDocuments(filter);

    // Get paginated leaders
    const leaders = await Leader.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter by search (name, email, username, phone) if provided
    let filteredLeaders = leaders;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredLeaders = leaders.filter(l =>
        (l.fullName?.toLowerCase().includes(searchLower)) ||
        (l.email?.toLowerCase().includes(searchLower)) ||
        (l.username?.toLowerCase().includes(searchLower)) ||
        (l.phoneNumber?.includes(search))
      );
    }

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: filteredLeaders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: GET /api/admin/leaders/:id - Get single leader
export const getAdminLeaderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid leader ID" });
    }

    const leader = await Leader.findById(id);

    if (!leader) {
      return res.status(404).json({ message: "Leader not found" });
    }

    res.json(leader);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: POST /api/admin/leaders - Create new leader
export const createAdminLeader = async (req, res) => {
  try {
    const { fullName, username, email, password, phoneNumber, address, status } = req.body;

    // Validate required fields
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: "fullName, username, email, password are required" });
    }

    // Check if username/email already exists
    const existing = await Leader.findOne({
      $or: [{ username }, { email }]
    });

    if (existing) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newLeader = await Leader.create({
      fullName,
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      phoneNumber: phoneNumber || "",
      address: address || "",
      status: status || "active"
    });

    console.log(`✅ Admin created leader: ${newLeader.fullName} (${newLeader.username})`);

    res.status(201).json({
      message: "Leader created successfully",
      leader: {
        _id: newLeader._id,
        fullName: newLeader.fullName,
        username: newLeader.username,
        email: newLeader.email,
        phoneNumber: newLeader.phoneNumber,
        address: newLeader.address,
        status: newLeader.status,
        createdAt: newLeader.createdAt,
        updatedAt: newLeader.updatedAt
      }
    });
  } catch (err) {
    console.error("❌ Error creating leader:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: PUT /api/admin/leaders/:id - Update leader
export const updateAdminLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, username, email, phoneNumber, address, status, password } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid leader ID" });
    }

    // Check if username/email already exists (excluding current leader)
    if (username || email) {
      const existing = await Leader.findOne({
        _id: { $ne: id },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email: email.toLowerCase() }] : [])
        ]
      });

      if (existing) {
        return res.status(400).json({ message: "Username or email already exists" });
      }
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (address !== undefined) updateData.address = address;
    if (status !== undefined) updateData.status = status;
    
    // Hash password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const leader = await Leader.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!leader) {
      return res.status(404).json({ message: "Leader not found" });
    }

    console.log(`✏️  Admin updated leader: ${leader.fullName}`);

    res.json({
      message: "Leader updated successfully",
      leader
    });
  } catch (err) {
    console.error("❌ Error updating leader:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: DELETE /api/admin/leaders/:id - Delete leader
export const deleteAdminLeader = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid leader ID" });
    }

    const leader = await Leader.findByIdAndDelete(id);

    if (!leader) {
      return res.status(404).json({ message: "Leader not found" });
    }

    console.log(`🗑️  Admin deleted leader: ${leader.fullName}`);

    res.json({
      message: "Leader deleted successfully",
      leader
    });
  } catch (err) {
    console.error("❌ Error deleting leader:", err.message);
    res.status(500).json({ message: err.message });
  }
};
