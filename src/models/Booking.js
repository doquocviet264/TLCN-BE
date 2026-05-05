import mongoose from "mongoose";

const paymentRefSchema = new mongoose.Schema(
  {
    provider: String, // momo | vnpay | sepay | manual | cod | refund
    ref:      String, // mã giao dịch từ cổng thanh toán
    amount:   Number,
    at:       Date,
    note:     String,
  },
  { _id: false }
);

const passengerSchema = new mongoose.Schema(
  {
    fullName:     { type: String, required: true },
    dateOfBirth:  Date,
    gender:       { type: String, enum: ["male", "female", "other"] },
    idNumber:     String, // CCCD / Passport
    type:         { type: String, enum: ["adult", "child"], default: "adult" },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    tourDepartureId: { type: mongoose.Schema.Types.ObjectId, ref: "TourDeparture", required: true },
    // userId tuỳ chọn: null = khách vãng lai (walk-in do Admin tạo)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // thông tin liên hệ người đặt (snapshot lúc đặt)
    fullName:    String,
    email:       String,
    phoneNumber: String,
    address:     String,
    note:        String, // ghi chú của khách

    // số lượng
    numAdults:   { type: Number, required: true, min: 0 },
    numChildren: { type: Number, required: true, min: 0 },

    // danh sách hành khách chi tiết (tuỳ chọn)
    passengers: { type: [passengerSchema], default: [] },

    // price snapshot tại thời điểm đặt
    priceAdultSnapshot: Number,
    priceChildSnapshot: Number,

    // tổng giá (sau discount)
    totalPrice:     { type: Number, required: true, min: 0 },

    // voucher & giảm giá
    voucherCode:    String,
    discountAmount: { type: Number, default: 0 },

    // Trạng thái booking
    // pending    → Chờ thanh toán cọc (50%)
    // confirmed  → Đã cọc ≥ 50% tổng tiền
    // completed  → Đã thanh toán 100%
    // cancelled  → Đã hủy
    bookingStatus: {
      type:    String,
      enum:    ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },

    // lý do hủy
    cancelReason: String,

    // mã đơn hàng (unique)
    code: { type: String, index: { unique: true, sparse: true } },

    // thanh toán
    paidAmount:   { type: Number, default: 0 },
    depositPaid:  { type: Boolean, default: false },

    paymentMethod: String, // momo | vnpay | sepay | manual | cod
    paymentRefs:   { type: [paymentRefSchema], default: [] },

    // đánh dấu admin tạo tay
    isAdminCreated: { type: Boolean, default: false },
  },
  {
    collection: "tbl_booking",
    timestamps: true,
  }
);

// Tự động tạo mã đơn hàng nếu chưa có
bookingSchema.pre("save", function (next) {
  if (!this.code) {
    // Tạo mã ngẫu nhiên: BK + 6 ký tự (VD: BK7A2F9B)
    this.code = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  next();
});

export const Booking = mongoose.model("Booking", bookingSchema);
