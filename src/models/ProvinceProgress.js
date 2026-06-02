import mongoose from "mongoose";

function slugify(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const provinceProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provinceName: { type: String, required: true },
    normalizedProvinceName: { type: String },
    unlockedAt: { type: Date, default: Date.now },
    source: {
      type: String,
      enum: ["manual", "tour", "both"],
      default: "manual",
    },
    firstMemoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelMemory",
    },
    completedTourIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tour",
      },
    ],
    completedBookingIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
  },
  { timestamps: true }
);

// Tự động tạo normalizedProvinceName khi lưu
provinceProgressSchema.pre("save", function (next) {
  if (this.isModified("provinceName") || !this.normalizedProvinceName) {
    this.normalizedProvinceName = slugify(this.provinceName || "");
  }
  next();
});

// Mỗi user + provinceName chỉ có 1 record
provinceProgressSchema.index(
  { userId: 1, normalizedProvinceName: 1 },
  { unique: true }
);

export const ProvinceProgress = mongoose.model(
  "ProvinceProgress",
  provinceProgressSchema,
  "tbl_province_progress"
);
