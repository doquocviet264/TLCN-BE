// src/models/BlogPost.js
import mongoose from "mongoose";

function slugify(str = "") {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

const commentSchema = new mongoose.Schema({
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
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
}, { _id: true }); // _id cho từng comment

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    index: true
  },
  summary: {
    type: String,
    default: ""
  },
  content: {
    type: String,
    default: ""
  },
  tags: {
    type: [String],
    default: []
  },
  coverImageUrl: {
    type: String,
    default: ""
  },
  coverImagePublicId: {
    type: String,
    default: ""
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },

  // status blog
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
    index: true
  },
  publishedAt: {
    type: Date
  },

  // rating tổng hợp
  ratingAvg: {
    type: Number,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },

  // danh sách comment + rating
  comments: {
    type: [commentSchema],
    default: []
  }

}, { timestamps: true });

// tạo slug tự động
blogSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title);
  }
  next();
});

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ title: "text", summary: "text", content: "text", tags: "text" });

export const BlogPost = mongoose.model("BlogPost", blogSchema, "tbl_blog");
