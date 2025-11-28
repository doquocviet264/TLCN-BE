import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  tourId:  { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true, index: true },
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  rating:  { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: "" },
}, { timestamps: true });

// 1 user chỉ đánh giá 1 lần / tour
reviewSchema.index({ tourId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema, "tbl_reviews");
