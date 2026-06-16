import { TravelMemory } from "../models/TravelMemory.js";
import { ProvinceProgress } from "../models/ProvinceProgress.js";
import { Booking } from "../models/Booking.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { MemoryLike } from "../models/MemoryLike.js";
import { MemoryComment } from "../models/MemoryComment.js";
import cloudinary from "../config/cloudinary.js";

const hasObjectId = (items = [], id) =>
  items.some((item) => item?.toString() === id?.toString());

const isValidMemoryImages = (images) =>
  Array.isArray(images) && images.length >= 1 && images.length <= 3;

const canAccessMemory = (memory, userId) =>
  memory?.privacy === "public" ||
  memory?.userId?.toString() === userId?.toString();

const uploadImageBuffer = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(file.buffer);
  });

export const uploadMemoryImages = async (req, res) => {
  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 ảnh",
      });
    }

    if (files.length > 3) {
      return res.status(400).json({
        success: false,
        message: "Tối đa 3 ảnh",
      });
    }

    const folder = `${process.env.CLOUDINARY_FOLDER || "travela"}/memories`;
    const uploaded = await Promise.all(
      files.map((file) => uploadImageBuffer(file, folder))
    );

    res.status(201).json({
      success: true,
      images: uploaded.map((item) => item.secure_url),
      publicIds: uploaded.map((item) => item.public_id),
    });
  } catch (error) {
    console.error("Error in uploadMemoryImages:", error);
    res.status(500).json({
      success: false,
      message: "Không thể upload ảnh",
      error: error.message,
    });
  }
};

// Lấy danh sách kỷ niệm của user đang đăng nhập (Timeline cá nhân)
export const getMyMemories = async (req, res) => {
  try {
    const userId = req.user.id;
    const { province, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (province) {
      query.provinceName = province;
    }

    const memories = await TravelMemory.find(query)
      .sort({ visitedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await TravelMemory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: memories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getMyMemories:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// Tạo kỷ niệm mới (Thủ công)
export const createMemory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provinceName, visitedAt, caption, images, privacy, source } =
      req.body;

    if (!provinceName || !visitedAt || !isValidMemoryImages(images)) {
      return res.status(400).json({
        success: false,
        message:
          "Vui lòng cung cấp đủ thông tin: provinceName, visitedAt, images (1-3 ảnh)",
      });
    }

    // Tạo Kỷ niệm mới
    const memory = new TravelMemory({
      userId,
      provinceName,
      visitedAt,
      caption,
      images,
      privacy: privacy || "private",
      source: source || "manual",
    });

    await memory.save();

    let provinceUnlocked = false;

    // Kiểm tra xem user đã mở khoá tỉnh này chưa
    const existingProgress = await ProvinceProgress.findOne({
      userId,
      normalizedProvinceName: memory.normalizedProvinceName,
    });

    if (!existingProgress) {
      // Mở khoá tỉnh lần đầu
      const progress = new ProvinceProgress({
        userId,
        provinceName: memory.provinceName,
        normalizedProvinceName: memory.normalizedProvinceName,
        unlockedAt: new Date(),
        source: memory.source,
        firstMemoryId: memory._id,
      });
      await progress.save();
      provinceUnlocked = true;

      // Tính điểm thưởng hoặc logic khác nếu cần thiết ở đây
    }

    if (existingProgress && memory.source === "manual" && existingProgress.source === "tour") {
      existingProgress.source = "both";
      await existingProgress.save();
    }

    res.status(201).json({
      success: true,
      message: "Tạo kỷ niệm thành công",
      memory,
      provinceUnlocked,
    });
  } catch (error) {
    console.error("Error in createMemory:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

// Tạo kỷ niệm từ booking đã hoàn thành
export const createMemoryFromBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.params;
    const { visitedAt, caption, images, privacy } = req.body;

    if (!visitedAt || !isValidMemoryImages(images)) {
      return res.status(400).json({
        success: false,
        message:
          "Vui lòng cung cấp đủ thông tin: visitedAt, images (1-3 ảnh)",
      });
    }

    // Kiểm tra booking thuộc về user và đã completed
    const booking = await Booking.findOne({ _id: bookingId, userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Không tìm thấy booking của bạn" });
    }
    if (booking.bookingStatus !== "completed") {
      return res.status(400).json({ success: false, message: "Chuyến đi chưa được đánh dấu hoàn thành" });
    }

    // Lấy tên tỉnh từ tour
    const departure = await TourDeparture.findById(booking.tourDepartureId).populate("tourId");
    if (!departure || !departure.tourId || !departure.tourId.destination) {
      return res.status(400).json({ success: false, message: "Tour không hợp lệ hoặc thiếu điểm đến" });
    }

    if (!["completed", "closed"].includes(departure.status)) {
      return res.status(400).json({
        success: false,
        message: "Chuyen di chua duoc danh dau hoan thanh",
      });
    }

    const provinceName = departure.tourId.destination;

    // Tạo Kỷ niệm mới
    const memory = new TravelMemory({
      userId,
      provinceName,
      visitedAt,
      caption,
      images,
      privacy: privacy || "private",
      source: "tour",
      tourId: departure.tourId._id,
      bookingId: booking._id,
      isVerifiedByTour: true,
    });

    await memory.save();

    // Cập nhật ProvinceProgress thành 'tour' hoặc 'both'
    let provinceUnlocked = false;
    let progress = await ProvinceProgress.findOne({
      userId,
      normalizedProvinceName: memory.normalizedProvinceName,
    });

    if (!progress) {
      progress = new ProvinceProgress({
        userId,
        provinceName: memory.provinceName,
        normalizedProvinceName: memory.normalizedProvinceName,
        unlockedAt: new Date(),
        source: "tour",
        firstMemoryId: memory._id,
        completedBookingIds: [booking._id],
        completedTourIds: [departure.tourId._id],
      });
      await progress.save();
      provinceUnlocked = true;
    } else {
      if (progress.source === "manual") progress.source = "both";
      if (!hasObjectId(progress.completedBookingIds, booking._id)) {
        progress.completedBookingIds.push(booking._id);
      }
      if (!hasObjectId(progress.completedTourIds, departure.tourId._id)) {
        progress.completedTourIds.push(departure.tourId._id);
      }
      await progress.save();
    }

    res.status(201).json({
      success: true,
      message: "Tạo kỷ niệm thành công",
      memory,
      provinceUnlocked,
    });
  } catch (error) {
    console.error("Error in createMemoryFromBooking:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

// Lấy danh sách kỷ niệm công cộng (Newsfeed / Cộng đồng)
export const getPublicMemories = async (req, res) => {
  try {
    const userId = req.user?.id; 
    const { province, page = 1, limit = 10 } = req.query;

    const query = { privacy: "public" };
    if (province) {
      query.provinceName = province;
    }

    const memories = await TravelMemory.find(query)
      .populate("userId", "fullName avatar")
      .sort({ visitedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await TravelMemory.countDocuments(query);

    // Kiem tra xem user hien tai da like chua
    if (userId) {
      const memoryIds = memories.map(m => m._id);
      const userLikes = await MemoryLike.find({
        userId,
        memoryId: { $in: memoryIds }
      });
      const likedMemoryIds = new Set(userLikes.map(l => l.memoryId.toString()));
      
      memories.forEach(m => {
        m.isLikedByMe = likedMemoryIds.has(m._id.toString());
      });
    }

    res.status(200).json({
      success: true,
      data: memories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getPublicMemories:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

export const getMemoryComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: memoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const memory = await TravelMemory.findById(memoryId).select("userId privacy");
    if (!memory) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy kỷ niệm" });
    }

    if (!canAccessMemory(memory, userId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem bình luận này",
      });
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 50);

    const comments = await MemoryComment.find({ memoryId })
      .populate("userId", "fullName avatar")
      .sort({ createdAt: 1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean();

    const total = await MemoryComment.countDocuments({ memoryId });

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error in getMemoryComments:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

export const createMemoryComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: memoryId } = req.params;
    const content = (req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung bình luận",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Bình luận tối đa 500 ký tự",
      });
    }

    const memory = await TravelMemory.findById(memoryId).select("userId privacy");
    if (!memory) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy kỷ niệm" });
    }

    if (!canAccessMemory(memory, userId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền bình luận kỷ niệm này",
      });
    }

    let comment = await MemoryComment.create({
      memoryId,
      userId,
      content,
    });

    await TravelMemory.findByIdAndUpdate(memoryId, {
      $inc: { commentsCount: 1 },
    });

    comment = await MemoryComment.findById(comment._id)
      .populate("userId", "fullName avatar")
      .lean();

    res.status(201).json({
      success: true,
      message: "Đã bình luận",
      comment,
    });
  } catch (error) {
    console.error("Error in createMemoryComment:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

export const deleteMemoryComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: memoryId, commentId } = req.params;

    const comment = await MemoryComment.findOne({ _id: commentId, memoryId });
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bình luận" });
    }

    const isOwner = comment.userId.toString() === userId.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bình luận này",
      });
    }

    await MemoryComment.findByIdAndDelete(commentId);
    await TravelMemory.findByIdAndUpdate(memoryId, {
      $inc: { commentsCount: -1 },
    });

    res.status(200).json({ success: true, message: "Đã xóa bình luận" });
  } catch (error) {
    console.error("Error in deleteMemoryComment:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

// Thích một kỷ niệm
export const likeMemory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: memoryId } = req.params;

    const existingLike = await MemoryLike.findOne({ userId, memoryId });
    if (existingLike) {
      return res.status(400).json({ success: false, message: "Bạn đã thích kỷ niệm này rồi" });
    }

    const like = new MemoryLike({ userId, memoryId });
    await like.save();

    await TravelMemory.findByIdAndUpdate(memoryId, { $inc: { likesCount: 1 } });

    res.status(200).json({ success: true, message: "Đã thích" });
  } catch (error) {
    console.error("Error in likeMemory:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

// Bỏ thích một kỷ niệm
export const unlikeMemory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: memoryId } = req.params;

    const deletedLike = await MemoryLike.findOneAndDelete({ userId, memoryId });
    if (!deletedLike) {
      return res.status(400).json({ success: false, message: "Bạn chưa thích kỷ niệm này" });
    }

    await TravelMemory.findByIdAndUpdate(memoryId, { $inc: { likesCount: -1 } });

    res.status(200).json({ success: true, message: "Đã bỏ thích" });
  } catch (error) {
    console.error("Error in unlikeMemory:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};
