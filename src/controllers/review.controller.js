import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";

// POST /api/reviews
export const createReview = async (req, res) => {
  try {
    const { tourId, rating, comment } = req.body;

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be 1-5" });
    }

    const tour = await Tour.findById(tourId);
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    // Kiểm tra đã đi tour chưa
    const now = new Date();
    const booked = await Booking.findOne({
      tourId,
      userId: req.user.id,
      bookingStatus: "c",         // bạn dùng 'c' = completed
    });

    if (!booked) {
      return res.status(403).json({ message: "You can only review tours you have completed" });
    }

    if (tour.endDate && tour.endDate > now) {
      return res.status(400).json({ message: "You can review after tour ends" });
    }

    // Tạo hoặc update nếu lỡ tồn tại
    const review = await Review.findOneAndUpdate(
      { tourId, userId: req.user.id },
      { rating, comment: comment || "" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: "Review saved", review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reviews/tour/:tourId
export const getReviewsOfTour = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }

    const reviews = await Review.find({ tourId })
      .populate("userId", "fullName username avatarUrl")
      .sort({ createdAt: -1 })
      .lean();

    const avg =
      reviews.length === 0
        ? 0
        : Number(
            (
              reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
            ).toFixed(1)
          );

    res.json({ total: reviews.length, averageRating: avg, data: reviews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reviews/me
export const myReviews = async (req, res) => {
  try {
    const data = await Review.find({ userId: req.user.id })
      .populate("tourId", "title destination startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ total: data.length, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: GET /api/reviews/admin - List all reviews with filters and pagination
export const getAdminReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, tourId, minRating, maxRating, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    
    if (tourId && mongoose.isValidObjectId(tourId)) {
      filter.tourId = tourId;
    }
    
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = parseInt(minRating);
      if (maxRating) filter.rating.$lte = parseInt(maxRating);
    }

    // Get total count
    const total = await Review.countDocuments(filter);

    // Get paginated reviews with user info
    const reviews = await Review.find(filter)
      .populate("userId", "fullName username avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter by search (user fullName, username, comment) if provided
    let filteredReviews = reviews;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredReviews = reviews.filter(r => 
        (r.userId?.fullName?.toLowerCase().includes(searchLower)) ||
        (r.userId?.username?.toLowerCase().includes(searchLower)) ||
        (r.comment?.toLowerCase().includes(searchLower))
      );
    }

    // Calculate average rating from all reviews
    const avgRating = reviews.length > 0
      ? Number((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1))
      : 0;

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      averageRating: avgRating,
      data: filteredReviews,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: DELETE /api/reviews/admin/:id - Delete a review
export const deleteAdminReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const review = await Review.findByIdAndDelete(id);
    
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Review deleted successfully", review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: PUT /api/reviews/admin/:id - Update a review
export const updateAdminReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: "Rating must be 1-5" });
    }

    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    const review = await Review.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("userId", "fullName username avatarUrl");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Review updated successfully", review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
