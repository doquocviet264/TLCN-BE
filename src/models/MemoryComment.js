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
    // Chi cho phep reply 1 cap: luon tro thang ve comment goc (root),
    // khong bao gio tro vao 1 comment khac cung la reply.
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemoryComment",
      default: null,
      index: true,
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
