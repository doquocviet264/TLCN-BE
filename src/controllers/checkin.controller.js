import { Checkin } from "../models/Checkin.js";
import { Booking } from "../models/Booking.js";

// --- 1. LẤY DANH SÁCH TỈNH ĐÃ ĐI (Để tô màu bản đồ) ---
export const getUserJourney = async (req, res) => {
  try {
    const userId = req.user.id;

    // A. Lấy check-in thủ công (từ bảng Checkin)
    const manualCheckins = await Checkin.find({ userId }).select(
      "provinceName"
    );

    // B. Lấy check-in tự động (từ đơn hàng Booking đã hoàn thành)
    const bookingCheckins = await Booking.find({
      userId,
      status: "completed",
    }).populate({
      path: "tourId",
      select: "province", // Chỉ cần lấy trường tỉnh
    });

    // C. Gộp lại và loại bỏ trùng lặp (Dùng Set)
    const visitedSet = new Set();

    // Thêm từ manual
    manualCheckins.forEach((c) => {
      if (c.provinceName) visitedSet.add(c.provinceName);
    });

    // Thêm từ booking
    bookingCheckins.forEach((b) => {
      if (b.tourId?.province) {
        visitedSet.add(b.tourId.province);
      }
    });

    // Trả về mảng tên tỉnh ["Hà Nội", "Đà Nẵng",...]
    res.json({
      total: visitedSet.size,
      provinces: Array.from(visitedSet),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy dữ liệu hành trình" });
  }
};

// --- 2. TẠO CHECK-IN MỚI & SINH VOUCHER ---
export const createCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provinceName, note, type = "manual" } = req.body;

    if (!provinceName) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp tên tỉnh thành" });
    }

    // A. Kiểm tra trùng (1 người chỉ check-in 1 tỉnh 1 lần)
    const existingCheckin = await Checkin.findOne({ userId, provinceName });
    if (existingCheckin) {
      return res.status(400).json({
        message: `Bạn đã check-in tại ${provinceName} rồi!`,
      });
    }

    // B. SINH MÃ VOUCHER TỰ ĐỘNG
    // Logic: VN + 3 chữ cái đầu của tỉnh (viết hoa, bỏ dấu) + 4 số ngẫu nhiên
    // VD: Hà Nội -> HAN -> VN-HAN-8392
    const shortName = provinceName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
      .replace(/\s/g, "") // Bỏ khoảng trắng
      .substring(0, 3)
      .toUpperCase();

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const voucherCode = `VN-${shortName}-${randomNum}`;

    // C. Lưu vào DB
    const newCheckin = new Checkin({
      userId,
      provinceName,
      type,
      note,
      voucherCode, // <--- Lưu mã này lại
      isUsed: false,
    });

    await newCheckin.save();

    // D. Trả về kết quả (Kèm voucherCode để Frontend hiện lên Popup)
    res.status(201).json({
      message: "Check-in thành công!",
      data: newCheckin,
      voucherCode: voucherCode,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Bạn đã check-in địa điểm này rồi." });
    }
    res.status(500).json({ message: error.message });
  }
};

// --- 3. LẤY DANH SÁCH VOUCHER (Mới thêm) ---
export const getMyVouchers = async (req, res) => {
  try {
    const userId = req.user.id;

    // Tìm những check-in có mã voucher
    const vouchers = await Checkin.find({
      userId,
      voucherCode: { $exists: true, $ne: null },
    })
      .select("provinceName voucherCode createdAt isUsed")
      .sort({ createdAt: -1 }); // Mới nhất lên đầu

    res.json({ data: vouchers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
