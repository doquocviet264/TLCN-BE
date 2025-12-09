import { Tour } from "../models/Tour.js";
import mongoose from "mongoose";

export const getTours = async (req, res) => {
  const { page = 1, limit = 10, destination, title } = req.query;
  const filter = {};
  if (destination)
    filter.destinationSlug = new RegExp(
      "^" +
        destination
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
  if (title) filter.title = { $regex: title, $options: "i" };

  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(parseInt(limit, 10) || 10, 50);

  const [data, total] = await Promise.all([
    Tour.find(filter)
      .sort({ startDate: 1, _id: 1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Tour.countDocuments(filter),
  ]);

  res.json({ total, page: p, limit: l, data });
};

export const getTourById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid tour id" });
  const tour = await Tour.findById(id).lean();
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
      { $match: { destinationSlug: { $regex: regex } } },
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
      q, // keyword (tự do)
      destination, // text người dùng gõ/chọn
      from, // YYYY-MM-DD
      to, // YYYY-MM-DD
      budgetMin, // số tiền
      budgetMax,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // keyword: fallback regex (nếu chưa bật text index)
    const qStr = q?.trim();
    if (qStr) {
      filter.$or = [
        { title: { $regex: qStr, $options: "i" } },
        { description: { $regex: qStr, $options: "i" } },
        { destination: { $regex: qStr, $options: "i" } },
      ];
      // Nếu đã tạo text index:
      // filter.$text = { $search: qStr };
    }

    // destination: prefix match trên destinationSlug (bỏ dấu)
    const destStr = destination?.trim();
    if (destStr) {
      const destSlug = slugOf(destStr);
      filter.destinationSlug = {
        $regex: new RegExp("^" + escapeRegex(destSlug)),
      };
    }

    // date range: tour nằm trong khoảng (from..to) nếu cả hai có
    if (from || to) {
      if (from)
        filter.startDate = {
          ...(filter.startDate || {}),
          $gte: new Date(from),
        };
      if (to)
        filter.endDate = { ...(filter.endDate || {}), $lte: new Date(to) };
    }

    // ngân sách theo priceAdult
    const min = budgetMin !== undefined ? Number(budgetMin) : undefined;
    const max = budgetMax !== undefined ? Number(budgetMax) : undefined;
    if (Number.isFinite(min) || Number.isFinite(max)) {
      filter.priceAdult = {};
      if (Number.isFinite(min)) filter.priceAdult.$gte = min;
      if (Number.isFinite(max)) filter.priceAdult.$lte = max;
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(parseInt(limit, 10) || 10, 50);

    // Nếu muốn nhẹ payload danh sách, có thể .select("-itinerary")
    const [data, total] = await Promise.all([
      Tour.find(filter)
        .sort({ startDate: 1, _id: 1 })
        // .select("-itinerary") // bật nếu muốn trả nhẹ ở trang list
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Tour.countDocuments(filter),
    ]);

    res.json({ total, page: p, limit: l, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
