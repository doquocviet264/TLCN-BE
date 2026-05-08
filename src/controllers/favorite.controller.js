import mongoose from "mongoose";
import { Favorite } from "../models/Favorite.js";
import { Tour } from "../models/Tour.js";

// Toggle favorite status
export const toggleFavorite = async (req, res) => {
  try {
    const { tourId } = req.body;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Mã tour không hợp lệ" });
    }

    const tourExists = await Tour.findById(tourId);
    if (!tourExists) {
      return res.status(404).json({ message: "Không tìm thấy tour" });
    }

    const existingFavorite = await Favorite.findOne({ userId, tourId });

    if (existingFavorite) {
      await Favorite.findByIdAndDelete(existingFavorite._id);
      return res.status(200).json({ message: "Đã bỏ yêu thích", isFavorite: false });
    } else {
      await Favorite.create({ userId, tourId });
      return res.status(201).json({ message: "Đã thêm vào mục yêu thích", isFavorite: true });
    }
  } catch (error) {
    console.error("Lỗi toggleFavorite:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// Lấy danh sách tour yêu thích của user
export const getMyFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const favorites = await Favorite.find({ userId })
      .populate({
        path: "tourId",
        select: "title destination images priceAdult priceChild time rating", // Select relevant fields
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out null tourId (in case a tour was deleted)
    const validFavorites = favorites.filter((fav) => fav.tourId != null);

    res.status(200).json({ data: validFavorites });
  } catch (error) {
    console.error("Lỗi getMyFavorites:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// Check xem 1 tour đã được yêu thích chưa
export const checkFavorite = async (req, res) => {
  try {
    const { tourId } = req.params;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Mã tour không hợp lệ" });
    }

    const favorite = await Favorite.findOne({ userId, tourId });

    res.status(200).json({ isFavorite: !!favorite });
  } catch (error) {
    console.error("Lỗi checkFavorite:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
