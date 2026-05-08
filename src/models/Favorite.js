import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "tbl_favorites",
  }
);

// Ensure a user can only favorite a tour once
favoriteSchema.index({ userId: 1, tourId: 1 }, { unique: true });

export const Favorite = mongoose.model("Favorite", favoriteSchema);
