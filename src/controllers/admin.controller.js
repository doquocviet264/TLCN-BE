// src/controllers/admin.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";      // ⬅️ dùng khi gán leaderId
import { Tour } from "../models/Tour.js";
import { Expense } from "../models/Expense.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { BlogPost } from "../models/BlogPost.js";

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
      averageRating
    ] = await Promise.all([
      // Basic counts
      User.countDocuments({ status: 'y' }),
      Tour.countDocuments(),
      Booking.countDocuments(),
      Review.countDocuments(),
      BlogPost.countDocuments(),
      
      // Active tours
      Tour.countDocuments({ status: { $in: ['confirmed', 'in_progress'] } }),
      
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
        .populate('tourId', 'title destination')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      
      // Popular tours (most bookings)
      Booking.aggregate([
        { $match: { bookingStatus: { $ne: 'x' } } },
        { 
          $group: { 
            _id: '$tourId', 
            bookingCount: { $sum: 1 },
            totalGuests: { $sum: { $add: ['$numAdults', '$numChildren'] } }
          }
        },
        { $sort: { bookingCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'tbl_tours',
            localField: '_id',
            foreignField: '_id',
            as: 'tour'
          }
        },
        { $unwind: '$tour' }
      ]),
      
      // Average rating
      Review.aggregate([
        { 
          $group: { 
            _id: null, 
            avgRating: { $avg: '$rating' } 
          }
        }
      ])
    ]);

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
        averageRating: averageRating[0]?.avgRating || 0
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
        title: item.tour.title,
        destination: item.tour.destination,
        bookingCount: item.bookingCount,
        totalGuests: item.totalGuests
      })),
      statusDistribution: {
        pending: 0,
        confirmed: 0,
        inProgress: 0,
        completed: 0,
        closed: 0
      }
    };

    // Get tour status distribution
    const statusCounts = await Tour.aggregate([
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

    const data = await Tour.find(filter)
      .select("title destination startDate endDate status leader leaderId current_guests min_guests max_guests departedAt arrivedAt finishedAt")
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
export const updateLeader = async (req, res) => {
  try {
    const { id } = req.params;                   // tourId
    const { leaderId, fullName, phoneNumber, note } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }

    const update = {};

    // Nếu truyền leaderId -> tìm Leader và gán
    if (leaderId) {
      if (!mongoose.isValidObjectId(leaderId)) {
        return res.status(400).json({ message: "Invalid leaderId" });
      }
      const leader = await Leader.findById(leaderId);
      if (!leader) return res.status(404).json({ message: "Leader not found" });

      update.leaderId = leader._id;
      // snapshot thông tin hiện tại vào embed leader
      update.leader = {
        fullName: leader.fullName,
        phoneNumber: leader.phoneNumber || "",
        note: note || ""
      };
    }

    // Nếu muốn cập nhật nhanh embed leader (không đổi leaderId)
    if (!leaderId && (fullName || phoneNumber || note !== undefined)) {
      if (!fullName || !phoneNumber) {
        return res.status(400).json({ message: "fullName & phoneNumber are required when updating leader snapshot" });
      }
      update.leader = { fullName, phoneNumber, note: note || "" };
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No changes" });
    }

    const tour = await Tour.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
    if (!tour) return res.status(404).json({ message: "Tour not found" });

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
    const { id } = req.params;                   // tourId
    const { eventType, at, place, note } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tourId" });
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

    const tour = await Tour.findByIdAndUpdate(id, update, { new: true });
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    res.json({ message: "Timeline updated", tour });
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
    const { id } = req.params; // tourId
    const { title, amount, note, visibleToCustomers = true } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }
    if (!title || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ message: "title & amount are required" });
    }
    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id)) {
      return res.status(401).json({ message: "Invalid admin ID" });
    }

    const expense = await Expense.create({
      tourId: new mongoose.Types.ObjectId(id),
      title,
      amount: Number(amount),
      occurredAt: new Date(),                        // ⏱ server time
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
    const { id } = req.params; // tourId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }
    const items = await Expense.find({ tourId: id })
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
    const { page = 1, limit = 20, status, destination, search } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
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

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(parseInt(limit, 10) || 20, 100);

    const [data, total] = await Promise.all([
      Tour.find(filter)
        .sort({ startDate: -1, createdAt: -1 })
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
    const tourData = req.body;

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

    const updateData = { ...req.body };

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

    const deletedTour = await Tour.findByIdAndDelete(id);

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