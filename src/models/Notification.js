import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "system",
        "booking",
        "tour",
        "payment",
        "promotion",
        "chat",
        "review",
        "checkin",
      ],
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String, default: null },
    link: { type: String, default: null },
    
    // Loại đối tượng nhận thông báo
    targetType: {
      type: String,
      enum: ["all", "user", "tour"],
      required: true,
    },
    // Nếu targetType = 'user', mảng này chứa danh sách ID người dùng nhận
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Nếu targetType = 'tour', gửi cho tất cả người dùng thuộc tour này (lấy từ Booking)
    targetTourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour" },
    
    // Đánh dấu những user đã đọc thông báo này
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    
    // Người tạo thông báo (có thể là Admin hoặc System)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin", // Hoặc có thể là User nếu là Chat/Review
      default: null,
    },
    
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes để query nhanh
notificationSchema.index({ targetType: 1 });
notificationSchema.index({ "targetUsers": 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model(
  "Notification",
  notificationSchema,
  "tbl_notifications"
);
