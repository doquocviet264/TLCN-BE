import mongoose from "mongoose";

function slugify(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const travelMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provinceName: { type: String, required: true },
    normalizedProvinceName: { type: String },
    visitedAt: { type: Date, required: true },
    caption: { type: String, default: "", maxLength: 500 },
    images: {
      type: [String],
      validate: {
        validator: function (v) {
          return v && v.length >= 1 && v.length <= 3; // MVP: 1-3 anh
        },
        message: "Can tai len it nhat 1 anh (toi da 3 anh).",
      },
    },
    privacy: {
      type: String,
      enum: ["private", "public"],
      default: "private",
    },
    source: {
      type: String,
      enum: ["manual", "tour"],
      default: "manual",
    },
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    isVerifiedByTour: { type: Boolean, default: false },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    // Id thanh tuu (xem PROVINCE_ACHIEVEMENTS) ma user vua dat duoc nho ky
    // niem nay, de hien thi noi bat tren ban tin va khuyen khich check-in
    earnedAchievementId: { type: String, default: null },
  },
  { timestamps: true }
);

// Tự động tạo normalizedProvinceName khi lưu
travelMemorySchema.pre("save", function (next) {
  if (this.isModified("provinceName") || !this.normalizedProvinceName) {
    this.normalizedProvinceName = slugify(this.provinceName || "");
  }
  next();
});

// Đánh chỉ mục để tối ưu truy vấn timeline và newsfeed
travelMemorySchema.index({ userId: 1, visitedAt: -1 });
travelMemorySchema.index({ privacy: 1, createdAt: -1 }); // Cho newsfeed cộng đồng (sort theo thời điểm chia sẻ)

export const TravelMemory = mongoose.model(
  "TravelMemory",
  travelMemorySchema,
  "tbl_travel_memories"
);
