import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { sendMail } from "../services/mailer.js";
// Import đầy đủ các mẫu email
import {
  getWelcomeTemplate,
  getResetPasswordTemplate,
  getOtpTemplate,
} from "../utils/emailTemplates.js";
import { Notification } from "../models/Notification.js";

// ============================================================
// 1. ĐĂNG KÝ (Gửi OTP, chưa cho đăng nhập ngay)
// ============================================================
export const register = async (req, res) => {
  try {
    const { fullName, username, email, password, phoneNumber } = req.body;

    // Sinh mã OTP (6 số)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 phút
    const hashedPassword = await bcrypt.hash(password, 10);
    // Hash OTP trước khi lưu vào DB (bảo mật)
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Kiểm tra user đã tồn tại chưa
    const exist = await User.findOne({ $or: [{ email }, { username }] });

    if (exist) {
      // TRƯỜNG HỢP 1: Tài khoản đã tồn tại và ĐÃ kích hoạt -> Báo lỗi
      if (exist.isVerified) {
        const field = exist.email === email ? "Email" : "Username";
        return res.status(400).json({ message: `${field} đã được sử dụng.` });
      }

      // TRƯỜNG HỢP 2: Tài khoản tồn tại nhưng CHƯA kích hoạt -> Gửi lại OTP mới (Không báo lỗi)
      // Cập nhật lại thông tin mới nhất user nhập
      exist.fullName = fullName;
      exist.password = hashedPassword;
      exist.phoneNumber = phoneNumber;
      exist.otpCode = hashedOtp; // Lưu OTP đã hash
      exist.otpExpires = otpExpires;
      await exist.save();

      // Gửi lại mail (gửi OTP gốc, không phải hash)
      if (email) {
        sendMail({
          to: email,
          subject: "Mã xác thực tài khoản Travela (Gửi lại)",
          html: getOtpTemplate(otp),
        }).catch((err) => console.error("Lỗi mail:", err));
      }

      return res.status(200).json({
        message: "Tài khoản chưa kích hoạt. Đã gửi lại mã OTP mới.",
        email: email,
      });
    }

    // TRƯỜNG HỢP 3: User mới tinh -> Tạo mới
    await User.create({
      fullName,
      username,
      email,
      phoneNumber,
      password: hashedPassword,
      isVerified: false,
      otpCode: hashedOtp, // Lưu OTP đã hash
      otpExpires: otpExpires,
    });

    if (email) {
      sendMail({
        to: email,
        subject: "Mã xác thực tài khoản Travela",
        html: getOtpTemplate(otp),
      }).catch((err) => console.error("Lỗi mail:", err));
    }

    res.status(201).json({
      message: "Đăng ký thành công. Vui lòng kiểm tra email.",
      email: email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 2. XÁC THỰC OTP (Mới)
// ============================================================
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    if (user.isVerified)
      return res
        .status(400)
        .json({ message: "Tài khoản đã được kích hoạt rồi." });

    // Kiểm tra OTP hết hạn trước
    if (!user.otpExpires || user.otpExpires < Date.now()) {
      return res
        .status(400)
        .json({ message: "Mã OTP đã hết hạn. Vui lòng lấy mã mới." });
    }

    // Kiểm tra OTP (so sánh với hash)
    const isOtpValid = await bcrypt.compare(otp, user.otpCode);
    if (!isOtpValid) {
      return res.status(400).json({ message: "Mã OTP không chính xác." });
    }

    // Xác thực thành công -> Kích hoạt User
    user.isVerified = true;
    user.otpCode = undefined; // Xóa OTP cũ
    user.otpExpires = undefined;
    await user.save();

    // Gửi mail Chào mừng sau khi kích hoạt thành công (Optional)
    sendMail({
      to: email,
      subject: "🎉 Chào mừng bạn gia nhập Travela!",
      html: getWelcomeTemplate(user.fullName),
    }).catch(console.error);

    // --- TẠO THÔNG BÁO CHÀO MỪNG ---
    Notification.create({
      type: "system",
      title: "Chào mừng bạn đến với Travela!",
      content: `Chúc mừng bạn đã trở thành thành viên của Travela. Hãy bắt đầu khám phá những chuyến đi tuyệt vời cùng chúng tôi nhé.`,
      link: `/user/tours`,
      targetType: "user",
      targetUsers: [user._id],
    }).catch(console.error);
    // --------------------------------

    res.json({
      message: "Kích hoạt tài khoản thành công! Bạn có thể đăng nhập ngay.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 3. GỬI LẠI OTP (Mới)
// ============================================================
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "Email chưa được đăng ký." });
    if (user.isVerified)
      return res
        .status(400)
        .json({ message: "Tài khoản này đã kích hoạt rồi." });

    // Sinh OTP mới
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Hash OTP trước khi lưu
    const hashedOtp = await bcrypt.hash(otp, 10);
    user.otpCode = hashedOtp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // 5 phút
    await user.save();

    // Gửi lại mail (gửi OTP gốc)
    sendMail({
      to: email,
      subject: "Gửi lại mã xác thực - Travela",
      html: getOtpTemplate(otp),
    }).catch(console.error);

    res.json({ message: "Đã gửi lại mã OTP vào email của bạn." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 4. ĐĂNG NHẬP (Có check isVerified, isActive, account lockout)
// ============================================================
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 phút

export const login = async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;
    const find = identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { username: identifier };

    const user = await User.findOne(find);
    if (!user)
      return res.status(404).json({ message: "Tài khoản không tồn tại." });

    // --- CHECK: Tài khoản bị khóa tạm thời (do nhập sai quá nhiều) ---
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Tài khoản tạm khóa do nhập sai quá nhiều. Vui lòng thử lại sau ${remainingTime} phút.`,
        locked: true,
      });
    }

    // --- CHECK: Tài khoản bị Admin khóa (banned) ---
    if (user.isActive === "n") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa. Vui lòng liên hệ Admin.",
        banned: true,
      });
    }

    // --- CHECK: Tài khoản bị vô hiệu hóa ---
    if (user.status === "n") {
      return res.status(403).json({
        message: "Tài khoản đã bị vô hiệu hóa.",
        disabled: true,
      });
    }

    // Nếu là tài khoản Google (không có pass)
    if (!user.password) {
      return res
        .status(400)
        .json({ message: "Tài khoản này đăng nhập bằng Google." });
    }

    // --- CHECK: ĐÃ KÍCH HOẠT CHƯA ---
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Tài khoản chưa được kích hoạt. Vui lòng xác thực OTP.",
        needVerify: true,
        email: user.email,
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      // Tăng số lần đăng nhập sai
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      // Nếu sai quá nhiều lần -> khóa tài khoản
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME);
        user.loginAttempts = 0;
        await user.save();
        return res.status(423).json({
          message: `Nhập sai quá ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản bị khóa 15 phút.`,
          locked: true,
        });
      }

      await user.save();
      const remaining = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
      return res.status(400).json({
        message: `Sai mật khẩu. Còn ${remaining} lần thử.`
      });
    }

    // Đăng nhập thành công -> Reset login attempts
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // Tạo Token
    const accessToken = jwt.sign(
      { id: String(user._id), role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    const refreshToken = jwt.sign(
      { id: String(user._id), type: "refresh" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Tạo Remember Token nếu user chọn "Ghi nhớ đăng nhập"
    let rememberToken = null;
    if (rememberMe) {
      rememberToken = crypto.randomBytes(32).toString("hex");
      user.rememberToken = await bcrypt.hash(rememberToken, 10);
      user.rememberTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày
    }

    await user.save();

    res.cookie("token", accessToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      message: "Đăng nhập thành công",
      accessToken,
      refreshToken,
      rememberToken, // Gửi về FE để lưu (đã được hash trong DB)
      user: {
        id: String(user._id),
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phoneNumber,
        gender: user.gender,
        dob: user.dob,
        city: user.city,
        hasPassword: !!user.password,
        isGoogleLogin: !!user.google_id,
        avatar: user.avatar || "/Image.svg",
        points: user.points || 0,
        memberStatus: user.memberStatus || "Thành viên",
        isActive: user.isActive,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 4.1. ĐĂNG NHẬP BẰNG REMEMBER TOKEN
// ============================================================
export const loginWithRememberToken = async (req, res) => {
  try {
    const { email, rememberToken } = req.body;

    if (!email || !rememberToken) {
      return res.status(400).json({ message: "Thiếu thông tin đăng nhập." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại." });
    }

    // Kiểm tra token hết hạn
    if (!user.rememberToken || !user.rememberTokenExpires || user.rememberTokenExpires < Date.now()) {
      return res.status(401).json({ message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
    }

    // Kiểm tra token có khớp không
    const isValidToken = await bcrypt.compare(rememberToken, user.rememberToken);
    if (!isValidToken) {
      return res.status(401).json({ message: "Token không hợp lệ." });
    }

    // Kiểm tra trạng thái tài khoản
    if (user.isActive === "n") {
      return res.status(403).json({ message: "Tài khoản đã bị khóa." });
    }

    // Tạo tokens mới
    const accessToken = jwt.sign(
      { id: String(user._id), role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    const refreshToken = jwt.sign(
      { id: String(user._id), type: "refresh" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Tạo remember token mới (rotation)
    const newRememberToken = crypto.randomBytes(32).toString("hex");
    user.rememberToken = await bcrypt.hash(newRememberToken, 10);
    user.rememberTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    res.cookie("token", accessToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      message: "Đăng nhập thành công",
      accessToken,
      refreshToken,
      rememberToken: newRememberToken,
      user: {
        id: String(user._id),
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phoneNumber,
        gender: user.gender,
        dob: user.dob,
        city: user.city,
        hasPassword: !!user.password,
        isGoogleLogin: !!user.google_id,
        avatar: user.avatar || "/Image.svg",
        points: user.points || 0,
        memberStatus: user.memberStatus || "Thành viên",
        isActive: user.isActive,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 5. QUÊN MẬT KHẨU - Bước 1: Gửi OTP
// ============================================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "Email không tồn tại trong hệ thống." });

    // Tạo OTP cho reset password
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.otpCode = hashedOtp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 phút cho reset password
    await user.save();

    // Gửi mail OTP
    await sendMail({
      to: email,
      subject: "Đặt lại mật khẩu - Travela",
      html: getOtpTemplate(otp),
    });

    res.json({ message: "Mã OTP đã được gửi về email của bạn.", email });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 5.1 QUÊN MẬT KHẨU - Bước 2: Xác thực OTP
// ============================================================
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Email không tồn tại." });

    // Kiểm tra OTP hết hạn
    if (!user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn." });
    }

    // Kiểm tra OTP
    const isOtpValid = await bcrypt.compare(otp, user.otpCode);
    if (!isOtpValid) {
      return res.status(400).json({ message: "Mã OTP không chính xác." });
    }

    // Tạo reset token tạm thời (valid 5 phút để đặt password mới)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = await bcrypt.hash(resetToken, 10);

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 phút
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      message: "Xác thực OTP thành công.",
      resetToken, // Gửi token về FE để dùng cho bước tiếp theo
      email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 5.2 QUÊN MẬT KHẨU - Bước 3: Đặt mật khẩu mới
// ============================================================
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Email không tồn tại." });

    // Kiểm tra reset token hết hạn
    if (!user.resetPasswordExpires || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại." });
    }

    // Kiểm tra reset token
    const isTokenValid = await bcrypt.compare(resetToken, user.resetPasswordToken);
    if (!isTokenValid) {
      return res.status(400).json({ message: "Token không hợp lệ." });
    }

    // Đặt mật khẩu mới
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0; // Reset login attempts
    user.lockUntil = undefined;
    await user.save();

    // Gửi mail thông báo
    await sendMail({
      to: email,
      subject: "Mật khẩu đã được đặt lại - Travela",
      html: getResetPasswordTemplate("Mật khẩu của bạn đã được đặt lại thành công. Nếu bạn không thực hiện hành động này, vui lòng liên hệ hỗ trợ ngay."),
    });

    res.json({ message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// 6. ĐĂNG XUẤT
// ============================================================
export const logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Đã đăng xuất thành công." });
};

// ============================================================
// 7. LẤY THÔNG TIN USER (Me)
// ============================================================
export const getProfile = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Yêu cầu đăng nhập." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    res.json({
      id: String(user._id),
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phoneNumber,
      gender: user.gender,
      dob: user.dob,
      city: user.city,
      hasPassword: !!user.password,
      isGoogleLogin: !!user.google_id,
      avatar: user.avatar || "/Image.svg",
      points: user.points || 0,
      memberStatus: user.memberStatus || "Thành viên",
      isActive: user.isActive,
      status: user.status,
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token không hợp lệ." });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Phiên đăng nhập hết hạn." });
    }
    res.status(500).json({ message: err.message });
  }
};
