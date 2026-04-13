import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import fs from "node:fs";
import path from "node:path";
import cloudinary from "../config/cloudinary.js";

export const getMyProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("-password").lean();
    if (!me) return res.status(404).json({ message: "User not found" });
    
    const secInfo = await User.findById(req.user.id).select("password google_id").lean();
    me.hasPassword = !!secInfo.password;
    me.isGoogleLogin = !!secInfo.google_id;

    res.json(me);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const { fullName, phoneNumber, address, avatar, username, gender, dob, city } = req.body;

    if (
      fullName === undefined &&
      phoneNumber === undefined &&
      address === undefined &&
      avatar === undefined &&
      username === undefined &&
      gender === undefined &&
      dob === undefined &&
      city === undefined
    ) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (username && username !== user.username) {
      // có thể thêm regex chặn ký tự lạ
      const exist = await User.findOne({ username });
      if (exist)
        return res.status(400).json({ message: "Username already taken" });
      user.username = username;
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (city !== undefined) user.city = city;

    await user.save();

    const safe = user.toObject();
    delete safe.password;
    res.json({ message: "Profile updated", user: safe });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "oldPassword and newPassword are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.password) {
      return res
        .status(400)
        .json({ message: "This account uses Google Login" });
    }

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok)
      return res.status(400).json({ message: "Old password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function baseUrl(req) {
  // 1. Ưu tiên dùng BASE_URL từ .env (production)
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, "");
  }

  // 2. Dev mode: dùng req.get("host") chứ không phải x-forwarded-host
  // (vì x-forwarded-host có thể bị override bởi proxy/tunnel)
  const proto = req.protocol || "http";
  const host = req.get("host");
  return `${proto}://${host}`;
}

export const uploadMyAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: "User not found" });

    // (tuỳ chọn) xoá file avatar cũ nếu nằm ở /uploads/avatars
    if (me.avatar?.startsWith("/uploads/avatars/")) {
      const p = path.resolve("." + me.avatar);
      fs.existsSync(p) && fs.unlink(p, () => {});
    }

    const urlPath = `/uploads/avatars/${req.file.filename}`; // path public
    me.avatar = urlPath; // lưu path (FE tự prepend domain)
    await me.save();

    const safe = me.toObject();
    delete safe.password;

    res.json({
      message: "Avatar updated",
      avatarPath: urlPath,
      avatarUrl: `${baseUrl(req)}${urlPath}`, // tiện cho FE test
      user: safe,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const uploadMyAvatarCloud = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: "User not found" });

    // Upload stream từ buffer
    const folder = process.env.CLOUDINARY_FOLDER || "travela/avatars";
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "image", overwrite: true },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    // Xoá ảnh cũ nếu có
    if (me.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(me.avatarPublicId);
      } catch {}
    }

    // Lưu vào schema field chính (avatar), không phải avatarUrl
    me.avatar = uploadResult.secure_url;
    me.avatarPublicId = uploadResult.public_id;
    await me.save();

    const safe = me.toObject();
    delete safe.password;

    res.json({
      message: "Avatar updated",
      avatarUrl: me.avatar, // Trả về avatar URL từ Cloudinary
      publicId: me.avatarPublicId,
      user: safe,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ====================================
 *  ADMIN: USER MANAGEMENT CRUD
 * ==================================== */

/** Lấy danh sách tất cả users */
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      if (status === "active") filter.isActive = "y";
      else if (status === "inactive") filter.isActive = "n";
    }

    const total = await User.countDocuments(filter);
    const data = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
      data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Lấy chi tiết user */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Tạo user mới (admin) */
export const createUserAdmin = async (req, res) => {
  try {
    const { email, username, fullName, password, phoneNumber, address } =
      req.body;

    if (!email || !username || !password) {
      return res
        .status(400)
        .json({ message: "email, username, password are required" });
    }

    const existEmail = await User.findOne({ email: email.toLowerCase() });
    if (existEmail)
      return res.status(400).json({ message: "Email already exists" });

    const existUsername = await User.findOne({ username });
    if (existUsername)
      return res.status(400).json({ message: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      fullName: fullName || username,
      phoneNumber: phoneNumber || "",
      address: address || "",
    });

    await user.save();

    const safe = user.toObject();
    delete safe.password;

    res.status(201).json({ message: "User created", user: safe });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Cập nhật user (admin) */
export const updateUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, username, fullName, phoneNumber, address } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (email && email !== user.email) {
      const exist = await User.findOne({ email: email.toLowerCase() });
      if (exist)
        return res.status(400).json({ message: "Email already exists" });
      user.email = email.toLowerCase();
    }

    if (username && username !== user.username) {
      const exist = await User.findOne({ username });
      if (exist)
        return res.status(400).json({ message: "Username already exists" });
      user.username = username;
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (address !== undefined) user.address = address;

    await user.save();

    const safe = user.toObject();
    delete safe.password;

    res.json({ message: "User updated", user: safe });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Reset mật khẩu user (admin) */
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "newPassword is required" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Xóa user (admin) */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Khóa/Mở Khóa user (admin) */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Đảo trạng thái: y -> n, n -> y
    user.isActive = user.isActive === "y" ? "n" : "y";
    // Tự động gỡ bỏ/thiết lập lockUntil nếu cần (khi unban thì mở luôn lock)
    if (user.isActive === "y") {
      user.lockUntil = undefined;
      user.loginAttempts = 0;
    }

    await user.save();
    res.json({ 
      message: user.isActive === "y" ? "Đã mở khóa người dùng" : "Đã khóa người dùng",
      isActive: user.isActive
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
