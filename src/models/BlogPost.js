// src/models/BlogPost.js
import mongoose from "mongoose";

function slugify(str = "") {
  // Thay thế ký tự đặc biệt tiếng Việt trước khi normalize
  const map = {
    đ: "d", Đ: "d",
    ơ: "o", Ơ: "o",
    ư: "u", Ư: "u",
    ă: "a", Ă: "a",
    â: "a", Â: "a",
    ê: "e", Ê: "e",
    ô: "o", Ô: "o",
  };
  const replaced = str.replace(/[đĐơƠưƯăĂâÂêÊôÔ]/g, (c) => map[c] || c);
  return replaced
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}



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
  categories: {
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
  authorModel: {
    type: String,
    enum: ["User", "Admin"],
    default: "Admin"
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "authorModel"
  },
  privacy: {
    type: String,
    enum: ["public", "private"],
    default: "public"
  },
  locationDetail: {
    type: String,
    default: ""
  },
  province: {
    type: String,
    default: ""
  },
  ward: {
    type: String,
    default: ""
  },
  rejectReason: {
    type: String,
    default: ""
  },

  // status blog
  status: {
    type: String,
    enum: ["draft", "pending", "published", "archived", "rejected"],
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

  // Kết quả kiểm duyệt tầng AI (chạy trước khi vào hàng chờ Admin duyệt)
  moderationMeta: {
    ai_action: {
      type: String,
      enum: ["approve", "reject", "flag_for_review"]
    },
    ai_confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    ai_reason: {
      type: String
    },
    ai_categories: {
      type: mongoose.Schema.Types.Mixed
    },
    ai_checked_at: {
      type: Date
    }
  },

}, { timestamps: true });

// tạo slug tự động
blogSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    const base = slugify(this.title);
    const suffix = Date.now().toString(36); // suffix ngắn tránh trùng slug
    this.slug = `${base}-${suffix}`;
  }
  next();
});

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ title: "text", summary: "text", content: "text", tags: "text" });

export const BlogPost = mongoose.model("BlogPost", blogSchema, "tbl_blog");
