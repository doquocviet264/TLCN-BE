import mongoose from "mongoose";

const paymentRefSchema = new mongoose.Schema(
  {
    provider: String, // momo | vnpay | manual | cod
    ref: String,      // mã giao dịch từ cổng thanh toán
    amount: Number,
    at: Date
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    tourDepartureId: { type: mongoose.Schema.Types.ObjectId, ref: "TourDeparture", required: true },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // thông tin liên hệ (lưu snapshot lúc đặt)
    fullName:    String,
    email:       String,
    phoneNumber: String,
    address:     String,

    // số lượng
    numAdults:    { type: Number, required: true, min: 0 },
    numChildren:  { type: Number, required: true, min: 0 },

    // giá chụp tại thời điểm đặt
    totalPrice:   { type: Number, required: true, min: 0 },

    // trạng thái: p (pending gom khách) | c (confirmed) | x (canceled)
    bookingStatus:{ type: String, enum: ["p","c","x"], default: "p" },

    // --- đặt cọc & thanh toán (tùy chọn) ---
    code:          { type: String, index: { unique: true, sparse: true } }, // mã đơn
    depositRate:   Number,   // 0..1  (vd 0.2)
    depositAmount: Number,   // số tiền cọc yêu cầu
    paidAmount:    { type: Number, default: 0 }, // tổng đã trả
    depositPaid:   { type: Boolean, default: false },

    paymentMethod: String, // momo | vnpay | manual | cod
    paymentRefs:   { type: [paymentRefSchema], default: [] },
  },
  {
    collection: "tbl_booking",  // 👈 đúng tên
    timestamps: true
  }
);

export const Booking = mongoose.model("Booking", bookingSchema);
