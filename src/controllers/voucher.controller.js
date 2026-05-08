import { Voucher } from "../models/Voucher.js";

// 1. Tạo Voucher (Admin)
export const createVoucher = async (req, res) => {
  try {
    const data = req.body;
    
    // Nếu client gửi lên chuỗi rỗng cho applicableTours thì chuyển thành mảng rỗng
    if (!data.applicableTours) data.applicableTours = [];

    // Chuyển code thành in hoa
    if (data.code) data.code = data.code.toUpperCase();

    // Check trùng mã
    const exists = await Voucher.findOne({ code: data.code });
    if (exists) {
      return res.status(400).json({ message: "Mã voucher đã tồn tại" });
    }

    const voucher = await Voucher.create(data);
    res.status(201).json({ message: "Tạo voucher thành công", voucher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. Lấy danh sách Voucher (Admin)
export const getVouchers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const s = req.query.search;
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
      ];
    }

    const total = await Voucher.countDocuments(filter);
    const vouchers = await Voucher.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ total, page, limit, data: vouchers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. Xem chi tiết Voucher (Admin)
export const getVoucherById = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id).populate("applicableTours", "title code");
    if (!voucher) return res.status(404).json({ message: "Voucher không tồn tại" });
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 4. Cập nhật Voucher (Admin)
export const updateVoucher = async (req, res) => {
  try {
    const data = req.body;
    
    if (data.code) {
      data.code = data.code.toUpperCase();
      // Check trùng mã (trừ chính nó)
      const exists = await Voucher.findOne({ code: data.code, _id: { $ne: req.params.id } });
      if (exists) return res.status(400).json({ message: "Mã voucher đã tồn tại" });
    }

    const voucher = await Voucher.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!voucher) return res.status(404).json({ message: "Voucher không tồn tại" });
    
    res.json({ message: "Cập nhật thành công", voucher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 5. Xóa Voucher (Admin)
export const deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) return res.status(404).json({ message: "Voucher không tồn tại" });
    res.json({ message: "Xóa voucher thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 8. Lấy voucher của tôi (User)
export const getMyVouchers = async (req, res) => {
  try {
    const userId = req.user?.id;
    // Lấy voucher được gán cho user HOẶC voucher công khai (userId = null)
    const vouchers = await Voucher.find({
      $or: [{ userId }, { userId: null }],
      status: "active",
      validUntil: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    res.json({ data: vouchers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 6. Nội bộ: Kiểm tra và tính toán Voucher
export const validateVoucherInternal = async (code, totalPrice, tourId) => {
  if (!code) throw new Error("Vui lòng nhập mã voucher");
  
  const voucher = await Voucher.findOne({ code: code.toUpperCase() });
  
  if (!voucher) throw new Error("Mã voucher không tồn tại");
  if (voucher.status !== "active") throw new Error("Voucher đã ngừng hoạt động");
  
  const now = new Date();
  if (now < voucher.validFrom) throw new Error("Voucher chưa tới thời gian áp dụng");
  if (now > voucher.validUntil) throw new Error("Voucher đã hết hạn");
  
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    throw new Error("Voucher đã hết lượt sử dụng");
  }
  
  if (totalPrice < voucher.minOrderValue) {
    throw new Error(`Đơn hàng tối thiểu để áp dụng là ${voucher.minOrderValue.toLocaleString()} VNĐ`);
  }
  
  // Nếu voucher có mảng applicableTours, check xem tourId có nằm trong đó không
  // tourId ở đây là tourTemplateId (từ departure.tourId)
  if (voucher.applicableTours && voucher.applicableTours.length > 0) {
    if (!tourId || !voucher.applicableTours.some(t => t.toString() === tourId.toString())) {
      throw new Error("Voucher không áp dụng cho tour này");
    }
  }
  
  // Tính tiền giảm
  let discount = 0;
  if (voucher.discountType === "percent") {
    discount = (totalPrice * voucher.discountValue) / 100;
    if (voucher.maxDiscount && discount > voucher.maxDiscount) {
      discount = voucher.maxDiscount;
    }
  } else {
    discount = voucher.discountValue;
  }
  
  // Không cho phép giảm quá tổng tiền
  if (discount > totalPrice) discount = totalPrice;

  return {
    voucher,
    discountAmount: Math.round(discount)
  };
};

// 7. Áp dụng Voucher (User checkout API)
export const applyVoucher = async (req, res) => {
  try {
    const { code, totalPrice, tourId } = req.body;
    const result = await validateVoucherInternal(code, totalPrice, tourId);
    
    res.json({
      message: "Áp dụng voucher thành công",
      discountAmount: result.discountAmount,
      voucher: {
        _id: result.voucher._id,
        code: result.voucher.code,
        name: result.voucher.name,
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

