import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  // Loại phòng chat
  // - booking: chat theo mã booking
  // - support: chat tư vấn trước khi đặt
  // - tour: nhóm chung theo tour
  roomType: {
    type: String,
    enum: ["booking", "support", "tour"],
    default: "booking",
    index: true
  },

  // ---- Booking chat ----
  bookingCode: { type: String, index: true },

  // ---- Tour group chat ----
  tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", index: true },

  // ---- Support chat (chưa đặt tour) ----
  supportId: { type: String, index: true }, // ví dụ: SUP-ABC123
  name:      { type: String },             // tên khách (guest)
  email:     { type: String },             // email khách (guest)

  // Người gửi (nếu là user/admin/leader đã đăng nhập)
  fromId:   { type: mongoose.Schema.Types.ObjectId },
  fromRole: {
    type: String,
    enum: ["guest", "user", "admin", "leader"],
    required: true
  },

  content:  { type: String, required: true, trim: true },
  isSystem: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Index để query nhanh theo phòng
chatSchema.index({ roomType: 1, bookingCode: 1, supportId: 1, tourId: 1, createdAt: 1 });

export const Chat = mongoose.model("Chat", chatSchema, "tbl_chat");
