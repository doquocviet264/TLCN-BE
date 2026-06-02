import mongoose from "mongoose";

const memoryLikeSchema = new mongoose.Schema(
  {
    memoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelMemory",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Tránh user spam like một memory nhiều lần
memoryLikeSchema.index({ memoryId: 1, userId: 1 }, { unique: true });

export const MemoryLike = mongoose.model(
  "MemoryLike",
  memoryLikeSchema,
  "tbl_memory_likes"
);
