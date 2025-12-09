import mongoose from "mongoose";

const checkinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provinceName: { type: String, required: true },

    placeId: { type: mongoose.Schema.Types.ObjectId, ref: "Place" },
    voucherCode: { type: String },
    isUsed: { type: Boolean, default: false },

    // Loại check-in: 'auto' (do đi tour về) hay 'manual' (tự bấm)
    type: { type: String, enum: ["auto", "manual"], default: "manual" },

    note: String,
  },
  { timestamps: true }
);

// Đảm bảo 1 user chỉ check-in 1 tỉnh 1 lần để không trùng lặp
checkinSchema.index({ userId: 1, provinceName: 1 }, { unique: true });
export const Checkin = mongoose.model("Checkin", checkinSchema);
