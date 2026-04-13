// src/models/BlogComment.js
import mongoose from "mongoose";

const blogCommentSchema = new mongoose.Schema({
  blogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BlogPost",
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  fullName: {
    type: String,
    default: ""
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

// Tự động xoá index trùng lặp nếu có do schema cũ ko có
blogCommentSchema.index({ blogId: 1, createdAt: -1 });

export const BlogComment = mongoose.model("BlogComment", blogCommentSchema, "tbl_blog_comment");
