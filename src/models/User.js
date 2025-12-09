import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // --- THÔNG TIN CƠ BẢN ---
  fullName: { type: String },
  username: { type: String, required: true, unique: true, index: true },
  email:    { type: String, required: true, unique: true, index: true },
  password: { type: String },
  phoneNumber: { type: String },
  address:  { type: String },
  
  // --- HÌNH ẢNH (Đã gộp gọn lại) ---
  avatar:         { type: String, default: "" }, // Lưu URL ảnh
  avatarPublicId: { type: String, default: "" }, // Lưu ID ảnh (nếu dùng Cloudinary)

  // --- TRẠNG THÁI & PHÂN QUYỀN ---
  isActive: { type: String, enum: ["y", "n"], default: "y" }, // Dùng để Admin khóa nick (y=active, n=banned)
  status:   { type: String, enum: ["y", "n"], default: "y" },
  google_id: { type: String }, // ID nếu đăng nhập bằng Google

  // --- [MỚI] XÁC THỰC OTP ---
  isVerified: { type: Boolean, default: false }, // false: Chưa nhập OTP, true: Đã xong
  otpCode:    { type: String },                  // Lưu mã 6 số (VD: 123456)
  otpExpires: { type: Date },                    // Thời gian hết hạn của mã

  // --- REMEMBER ME TOKEN ---
  rememberToken: { type: String },               // Token cho chức năng "Ghi nhớ đăng nhập"
  rememberTokenExpires: { type: Date },          // Thời gian hết hạn (30 ngày)

  // --- SECURITY ---
  loginAttempts: { type: Number, default: 0 },   // Số lần đăng nhập sai
  lockUntil: { type: Date },                     // Khóa tài khoản đến thời điểm này

  // --- RESET PASSWORD ---
  resetPasswordToken: { type: String },          // Token để đặt lại mật khẩu
  resetPasswordExpires: { type: Date },          // Thời gian hết hạn token

  createdDate: { type: Date, default: Date.now }
}, { 
  timestamps: true, // Tự động thêm createdAt và updatedAt (Rất nên dùng)
  collection: "tbl_users" // Giữ nguyên tên bảng cũ của bạn
});

export const User = mongoose.model("User", userSchema);