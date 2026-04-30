import { Tour } from "../models/Tour.js";
import { TourDeparture } from "../models/TourDeparture.js";
import mongoose from "mongoose";

export const getTours = async (req, res) => {
  const { page = 1, limit = 10, destination, title } = req.query;
  const filter = { status: "active" };
  
  if (destination) {
    const dSlug = destination
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    filter.destinationSlug = new RegExp("^" + dSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }

  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(parseInt(limit, 10) || 10, 50);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: filter },
    // Liên kết với Departures để lấy ngày khởi hành gần nhất
    {
      $lookup: {
        from: "tbl_tour_departures",
        let: { tourId: "$_id" },
        pipeline: [
          { $match: { 
              $expr: { $eq: ["$tourId", "$$tourId"] },
              startDate: { $gte: today },
              status: { $ne: "closed" }
          } },
          { $sort: { startDate: 1 } },
          { $project: { _id: 1, startDate: 1, endDate: 1, current_guests: 1, max_guests: 1, priceAdult: 1 } }
        ],
        as: "upcomingDepartures"
      }
    },
    {
      $addFields: {
        // Ngày khởi hành gần nhất
        nextDepartureDate: { $arrayElemAt: ["$upcomingDepartures.startDate", 0] },
        // Tổng số chỗ còn lại của các tour sắp tới? (Hoặc chỉ lấy của tour gần nhất)
        availableSeats: { $arrayElemAt: ["$upcomingDepartures.max_guests", 0] },
        currentGuests: { $arrayElemAt: ["$upcomingDepartures.current_guests", 0] }
      }
    },
    {
      $addFields: {
        // Sắp xếp: có lịch khởi hành lên trước, không có xuống sau
        hasUpcoming: { $cond: [{ $gt: [{ $size: "$upcomingDepartures" }, 0] }, 1, 0] }
      }
    },
    // Sắp xếp: hasUpcoming giảm dần (1 -> 0), sau đó nextDepartureDate tăng dần
    { $sort: { hasUpcoming: -1, nextDepartureDate: 1, _id: 1 } },
    { $skip: (p - 1) * l },
    { $limit: l }
  ];

  const [data, total] = await Promise.all([
    Tour.aggregate(pipeline),
    Tour.countDocuments(filter),
  ]);

  res.json({ total, page: p, limit: l, data });
};

export const getTourById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid tour id" });
  const tour = await Tour.findOne({ _id: id, status: { $ne: "deleted" } }).lean();
  if (!tour) return res.status(404).json({ message: "Tour not found" });
  res.json(tour);
};

export const createTour = async (req, res) => {
  try {
    const body = req.body;

    // Bảo đảm images có 5 ảnh (tự bổ sung nếu thiếu)
    if (!Array.isArray(body.images)) body.images = [];
    if (body.images.length < 5) {
      const base = (body.destination || "tour")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "-");
      while (body.images.length < 5) {
        body.images.push(`/images/${base}/${body.images.length + 1}.jpg`);
      }
    }

    // Itinerary: cho phép theo đúng structure client gửi (đã validate ở routes nếu có)
    const tour = await Tour.create(body);
    res.status(201).json(tour);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTour = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid tour id" });

    const update = { ...req.body };

    // Nếu client gửi images < 5, tự fill đủ 5
    if (Array.isArray(update.images) && update.images.length < 5) {
      const base = (update.destination || update.destinationSlug || "tour")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "-");
      while (update.images.length < 5) {
        update.images.push(`/images/${base}/${update.images.length + 1}.jpg`);
      }
    }

    const tour = await Tour.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!tour) return res.status(404).json({ message: "Tour not found" });
    res.json(tour);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteTour = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid tour id" });
  const ok = await Tour.findByIdAndDelete(id);
  if (!ok) return res.status(404).json({ message: "Tour not found" });
  res.json({ message: "Tour deleted" });
};

function slugOf(s = "") {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function escapeRegex(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/tours/suggest?term=ha&limit=8
export const suggestDestinations = async (req, res) => {
  try {
    const term = (req.query.term || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "8", 10), 20);
    if (!term) return res.json([]);

    const slug = slugOf(term);
    const regex = new RegExp("^" + escapeRegex(slug));

    const rows = await Tour.aggregate([
      { $match: { destinationSlug: { $regex: regex }, status: "active" } },
      { $group: { _id: "$destination", cnt: { $sum: 1 } } },
      { $sort: { cnt: -1, _id: 1 } },
      { $limit: limit },
    ]);

    res.json(rows.map((r) => r._id).filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateLeader = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid tour id" });

    const { leaderId, fullName, phoneNumber, note } = req.body;

    let update = {};

    // Cách 1: Gắn theo leaderId (tham chiếu từ collection Leader)
    if (leaderId) {
      if (!mongoose.isValidObjectId(leaderId)) {
        return res.status(400).json({ message: "Invalid leaderId" });
      }

      // Import Leader model nếu chưa
      const { Leader } = await import("../models/Leader.js");
      const leader = await Leader.findById(leaderId);
      if (!leader) return res.status(404).json({ message: "Leader not found" });

      // Snapshot dữ liệu leader hiện tại
      update.leaderId = leader._id;
      update.leader = {
        fullName: leader.fullName,
        phoneNumber: leader.phoneNumber,
        note: note || "",
      };
    }
    // Cách 2: Cập nhật trực tiếp snapshot (không đổi leaderId)
    else if (fullName && phoneNumber) {
      update.leader = {
        fullName,
        phoneNumber,
        note: note || "",
      };
    } else {
      return res.status(400).json({
        message: "Yêu cầu: (leaderId) hoặc (fullName + phoneNumber)",
      });
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

// GET /api/tours/search?... (public)
export const searchTours = async (req, res) => {
  try {
    const {
      q,
      destination,
      from,
      to,
      budgetMin,
      budgetMax,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { status: "active" };

    const qStr = q?.trim();
    if (qStr) {
      filter.$or = [
        { title: { $regex: new RegExp(escapeRegex(qStr), "i") } },
        { description: { $regex: new RegExp(escapeRegex(qStr), "i") } },
        { destination: { $regex: new RegExp(escapeRegex(qStr), "i") } },
      ];
    }

    const destStr = destination?.trim();
    if (destStr) {
      const destSlug = slugOf(destStr);
      filter.destinationSlug = { $regex: new RegExp("^" + escapeRegex(destSlug)) };
    }

    // Giá: Lọc dựa trên metadata của Template (hoặc Departure nếu cần, nhưng Template cho nhanh)
    if (budgetMin != null || budgetMax != null) {
      filter.priceAdult = {};
      if (budgetMin != null) filter.priceAdult.$gte = Number(budgetMin);
      if (budgetMax != null) filter.priceAdult.$lte = Number(budgetMax);
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(parseInt(limit, 10) || 10, 50);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "tbl_tour_departures",
          let: { tourId: "$_id" },
          pipeline: [
            { $match: { 
                $expr: { $eq: ["$tourId", "$$tourId"] },
                startDate: { $gte: today },
                status: { $ne: "closed" }
            } },
            // Thêm filter date nếu người dùng chọn from/to
            ...( (from || to) ? [
                 { $match: {
                    startDate: {
                      ...(from ? { $gte: new Date(from) } : {}),
                      ...(to ? { $lte: new Date(to) } : {})
                    }
                 } }
            ] : []),
            { $sort: { startDate: 1 } },
          ],
          as: "upcomingDepartures"
        }
      },
      // Nếu có filter from/to, chỉ lấy những tour có ít nhất 1 departure thỏa mãn
      ...( (from || to) ? [{ $match: { "upcomingDepartures.0": { $exists: true } } }] : []),
      {
        $addFields: {
          nextDepartureDate: { $arrayElemAt: ["$upcomingDepartures.startDate", 0] },
          hasUpcoming: { $cond: [{ $gt: [{ $size: "$upcomingDepartures" }, 0] }, 1, 0] }
        }
      },
      { $sort: { hasUpcoming: -1, nextDepartureDate: 1, _id: 1 } },
      { $skip: (p - 1) * l },
      { $limit: l }
    ];

    const [data, total] = await Promise.all([
      Tour.aggregate(pipeline),
      Tour.countDocuments(filter), 
    ]);

    res.json({ total, page: p, limit: l, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
