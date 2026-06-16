import mongoose from "mongoose";

const memoryCommentSchema = new mongoose.Schema(
  {
    memoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelMemory",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

memoryCommentSchema.index({ memoryId: 1, createdAt: 1 });

export const MemoryComment = mongoose.model(
  "MemoryComment",
  memoryCommentSchema,
  "tbl_memory_comments"
);
