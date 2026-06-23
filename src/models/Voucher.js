import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    // Mã giảm giá (VD: SUMMER2026)
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    
    // Tên/Mô tả chiến dịch (VD: Giảm giá mùa hè)
    name: { type: String, required: true },
    description: String,
    
    // Hình ảnh chiến dịch/Voucher
    image: { type: String, default: "" },

    // Loại giảm giá
    // 'percent': Giảm theo phần trăm
    // 'fixed': Giảm số tiền cố định
    discountType: { type: String, enum: ["percent", "fixed"], required: true },
    
    // Giá trị giảm (Ví dụ: 10 nếu là 10%, hoặc 500000 nếu là 500k)
    discountValue: { type: Number, required: true, min: 0 },
    
    // Số tiền giảm tối đa (Chỉ áp dụng khi discountType = 'percent')
    maxDiscount: { type: Number, default: null },
    
    // Giá trị đơn hàng tối thiểu để được áp dụng voucher
    minOrderValue: { type: Number, default: 0 },

    // Thời gian áp dụng
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },

    // Giới hạn số lượng sử dụng tổng cộng
    usageLimit: { type: Number, default: null }, // null = không giới hạn
    usedCount: { type: Number, default: 0 },

    // Giới hạn sử dụng mỗi user (Thường là 1)
    userUsageLimit: { type: Number, default: 1 },

    // (Tùy chọn) Chỉ áp dụng cho các Tour cụ thể. Nếu mảng rỗng thì áp dụng toàn hệ thống.
    applicableTours: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tour" }],

    // Trạng thái bật/tắt thủ công từ Admin
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  {
    collection: "tbl_voucher",
    timestamps: true,
  }
);

// Lưu ý: index { code: 1 } đã được tạo tự động bởi unique: true ở trên, không cần khai báo lại.
// Index tự động ẩn các voucher hết hạn nếu cần truy vấn nhanh
voucherSchema.index({ validUntil: 1 });

export const Voucher = mongoose.model("Voucher", voucherSchema);
