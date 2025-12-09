import mongoose from "mongoose";
import { Tour } from "../models/Tour.js";
import { Booking } from "../models/Booking.js";
import { sendMail } from "../services/mailer.js";
import { notifyTourConfirmed } from "../services/notify.js";
// Import các template email đẹp
import {
  getBookingCreatedTemplate,
  getPaymentReceiptTemplate,
} from "../utils/emailTemplates.js";

// ==================== CLIENT BOOKING FLOW ====================

// 1. Tạo Booking Mới (Gửi mail xác nhận đặt tour)
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.startTransaction();

    let tourId,
      numAdults,
      numChildren,
      fullName,
      email,
      phoneNumber,
      address,
      note;

    // Parse input data (hỗ trợ cả format cũ và mới)
    if (req.body.contact) {
      const { tourId: tId, contact, guests } = req.body;
      tourId = tId;
      numAdults = guests?.adults || 1;
      numChildren = guests?.children || 0;
      fullName = contact?.fullName;
      email = contact?.email;
      phoneNumber = contact?.phone;
      address = contact?.address;
      note = req.body.note;
    } else {
      const data = req.body;
      tourId = data.tourId;
      numAdults = data.numAdults || 1;
      numChildren = data.numChildren || 0;
      fullName = data.fullName;
      email = data.email;
      phoneNumber = data.phoneNumber;
      address = data.address;
      note = data.note;
    }

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({ message: "Invalid tourId" });
    }

    const tour = await Tour.findById(tourId).session(session);
    if (!tour) return res.status(404).json({ message: "Tour not found" });
    if (tour.status === "closed")
      return res.status(400).json({ message: "Tour is closed" });

    // Validate số lượng khách
    const guestsRequested =
      (Number(numAdults) || 0) + (Number(numChildren) || 0);
    if (guestsRequested <= 0)
      return res.status(400).json({ message: "Invalid guests" });

    // Check slot còn trống
    if (Number.isFinite(tour.quantity)) {
      const after = (tour.current_guests || 0) + guestsRequested;
      if (after > tour.quantity) {
        return res.status(400).json({
          message: "Not enough slots",
          available: Math.max(
            0,
            (tour.quantity || 0) - (tour.current_guests || 0)
          ),
        });
      }
    }

    // Tính toán giá tiền
    const priceAdult = tour.priceAdult ?? 0;
    const priceChild = tour.priceChild ?? Math.round(priceAdult * 0.6);
    const totalPrice =
      Number(numAdults) * priceAdult + Number(numChildren) * priceChild;

    const alreadyConfirmed =
      tour.status === "confirmed" ||
      tour.current_guests >= (tour.min_guests || 0);
    const depositRate = alreadyConfirmed
      ? 1
      : Number(process.env.BOOKING_DEPOSIT_RATE ?? 0.2);
    const depositAmount = Math.round(totalPrice * depositRate);

    const code = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // Tạo booking
    const [booking] = await Booking.create(
      [
        {
          code,
          tourId,
          userId: req.user.id,
          fullName,
          email,
          phoneNumber,
          address,
          note,
          numAdults,
          numChildren,
          totalPrice,
          bookingStatus: "p",
          depositRate,
          depositAmount,
          paymentMethod: "momo",
          paidAmount: 0,
          depositPaid: false,
          paymentRefs: [],
          requireFullPayment: alreadyConfirmed,
        },
      ],
      { session }
    );

    // Giảm số chỗ ngồi ngay khi tạo booking (reserve seats)
    await Tour.updateOne(
      { _id: tourId },
      { $inc: { current_guests: guestsRequested } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // --- GỬI EMAIL XÁC NHẬN ĐẶT TOUR ---
    if (booking.email) {
      sendMail({
        to: booking.email,
        subject: `✅ Xác nhận đặt tour: ${tour.title} (#${booking.code})`,
        html: getBookingCreatedTemplate(booking, tour),
      }).catch((err) => console.error("Send booking mail error:", err));
    }
    // ------------------------------------

    return res.status(201).json({
      message: "Booking created successfully",
      code: booking.code,
      total: booking.totalPrice,
      depositAmount: booking.depositAmount,
      booking,
    });
  } catch (err) {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch {}
    try {
      session.endSession();
    } catch {}
    return res.status(500).json({ message: err.message });
  }
};

// 2. Xử lý Thanh Toán (Gửi mail biên lai)
export const onPaymentReceived = async (req, res) => {
  try {
    const { code, amount, provider = "momo", ref = Date.now() } = req.body;

    // Tìm booking & populate tour để lấy thông tin tour cho mail (nếu cần)
    const booking = await Booking.findOne({ code });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Idempotency check
    if (
      booking.paymentRefs?.some(
        (p) => p.ref === String(ref) && p.provider === provider
      )
    ) {
      return res.json({ message: "Already processed", booking });
    }

    const isFirstDeposit = !booking.depositPaid && Number(amount) > 0;

    // Cập nhật tiền
    booking.paidAmount = (booking.paidAmount || 0) + Number(amount || 0);
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider,
      ref: String(ref),
      amount: Number(amount || 0),
      at: new Date(),
    });

    if (isFirstDeposit) booking.depositPaid = true;
    if (booking.paidAmount >= booking.totalPrice) booking.bookingStatus = "c";

    await booking.save();

    // --- GỬI EMAIL BIÊN LAI THANH TOÁN ---
    if (booking.email && Number(amount) > 0) {
      const isFullPaid = booking.paidAmount >= booking.totalPrice;
      sendMail({
        to: booking.email,
        subject: `💸 Xác nhận thanh toán - Đơn #${booking.code}`,
        html: getPaymentReceiptTemplate(booking, Number(amount)),
      }).catch((err) => console.error("Send payment mail error:", err));
    }
    // -------------------------------------

    // Auto confirm tour nếu đủ khách (slot đã được reserve lúc tạo booking)
    if (isFirstDeposit) {
      const tour = await Tour.findById(booking.tourId);

      // Auto confirm tour nếu đủ khách
      if (
        tour &&
        (tour.current_guests || 0) >= (tour.min_guests || 0) &&
        tour.status !== "confirmed"
      ) {
        tour.status = "confirmed";
        await tour.save();

        // Gửi mail thông báo tour khởi hành cho TẤT CẢ khách
        await notifyTourConfirmed(tour._id);
      }
    }

    return res.json({ message: "Payment recorded", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. Lịch sử đơn hàng (User)
export const myBookings = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);

  const [rows, total] = await Promise.all([
    Booking.find({ userId: req.user.id })
      .populate(
        "tourId",
        "title destination startDate endDate cover images time priceAdult priceChild"
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments({ userId: req.user.id }),
  ]);

  res.json({ total, page, limit, data: rows });
};

// 4. Hủy đơn (User)
export const cancelBookingByUser = async (req, res) => {
  const { code } = req.params;
  const bk = await Booking.findOne({ code, userId: req.user.id });

  if (!bk) return res.status(404).json({ message: "Booking not found" });
  if (bk.bookingStatus !== "p") {
    return res
      .status(400)
      .json({ message: "Only pending bookings can be canceled" });
  }

  bk.bookingStatus = "x";
  await bk.save();

  // Trả lại slot khi hủy booking
  const guestsToRelease = (bk.numAdults || 0) + (bk.numChildren || 0);
  if (guestsToRelease > 0) {
    await Tour.updateOne(
      { _id: bk.tourId },
      { $inc: { current_guests: -guestsToRelease } }
    );
  }

  // Có thể thêm gửi mail thông báo hủy ở đây nếu muốn

  res.json({ message: "Canceled", booking: bk });
};

// 5. Chi tiết đơn hàng (User)
export const getMyBookingDetail = async (req, res) => {
  try {
    const { code } = req.params;
    const booking = await Booking.findOne({ code, userId: req.user.id })
      .populate(
        "tourId",
        "title destination startDate endDate images time priceAdult priceChild status itinerary"
      )
      .lean();

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.json({
      ...booking,
      tour: booking.tourId
        ? {
            id: booking.tourId._id,
            title: booking.tourId.title,
            destination: booking.tourId.destination,
            startDate: booking.tourId.startDate,
            endDate: booking.tourId.endDate,
            time: booking.tourId.time,
            status: booking.tourId.status,
            images: booking.tourId.images || [],
            itinerary: booking.tourId.itinerary || [],
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// 6. Admin: Lấy danh sách Booking (Có lọc)
export const getAdminBookings = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status.trim())
      filter.bookingStatus = req.query.status;
    if (req.query.tourId && mongoose.isValidObjectId(req.query.tourId))
      filter.tourId = req.query.tourId;

    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate("tourId", "title destination startDate endDate")
      .populate("userId", "fullName username email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Search thủ công (nếu cần filter phức tạp hơn)
    let filteredBookings = bookings;
    if (req.query.search && req.query.search.trim()) {
      const s = req.query.search.toLowerCase();
      filteredBookings = bookings.filter(
        (b) =>
          b.fullName?.toLowerCase().includes(s) ||
          b.email?.toLowerCase().includes(s) ||
          b.code?.toLowerCase().includes(s) ||
          b.phoneNumber?.includes(s)
      );
    }

    res.json({ total, page, limit, data: filteredBookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 7. Admin: Chi tiết Booking
export const getAdminBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("tourId")
      .populate("userId", "fullName email");
    if (!booking) return res.status(404).json({ message: "Not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 8. Admin: Cập nhật trạng thái Booking
export const updateAdminBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { bookingStatus: status },
      { new: true }
    )
      .populate("tourId")
      .populate("userId");

    if (!booking) return res.status(404).json({ message: "Not found" });

    // Nếu Admin xác nhận Tour (status -> 'c'), gửi mail thông báo
    if (status === "c") {
      notifyTourConfirmed(booking.tourId._id).catch(console.error);
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 9. Admin: Xóa Booking
export const deleteAdminBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 10. Admin: Cập nhật thanh toán thủ công (COD/Manual)
export const updateAdminBookingPayment = async (req, res) => {
  try {
    const { action, amount, provider = "manual", ref } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Not found" });

    if (action === "mark_paid") {
      const paymentAmount =
        Number(amount) || booking.totalPrice - booking.paidAmount;

      booking.paidAmount += paymentAmount;
      booking.paymentRefs.push({
        provider,
        ref: ref || `ADMIN_${Date.now()}`,
        amount: paymentAmount,
        at: new Date(),
      });

      if (!booking.depositPaid && paymentAmount >= booking.depositAmount)
        booking.depositPaid = true;
      if (booking.paidAmount >= booking.totalPrice) booking.bookingStatus = "c";

      await booking.save();

      // Gửi mail xác nhận thanh toán (nếu admin thao tác)
      if (booking.email) {
        sendMail({
          to: booking.email,
          subject: `💸 Xác nhận thanh toán (Admin) - Đơn #${booking.code}`,
          html: getPaymentReceiptTemplate(booking, paymentAmount),
        }).catch(console.error);
      }

      res.json({ message: "Payment updated", booking });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 11. Admin: Thống kê thanh toán
export const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$paidAmount" },
        },
      },
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// 12. ADMIN: Đánh dấu thanh toán hàng loạt (Bulk Mark Paid)
export const bulkMarkBookingsPaid = async (req, res) => {
  try {
    const { bookingIds, amount, provider = "manual", note } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ message: "Invalid bookingIds array" });
    }

    const validIds = bookingIds.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ message: "No valid booking IDs" });
    }

    // Tìm các booking chưa thanh toán hết và phương thức cho phép (cod/manual)
    const bookings = await Booking.find({
      _id: { $in: validIds },
      paymentMethod: { $in: ["cod", "manual"] },
    });

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No eligible bookings found" });
    }

    const updated = [];
    for (const booking of bookings) {
      // Nếu không nhập amount, mặc định là trả hết phần còn thiếu
      const paymentAmount = amount
        ? Number(amount)
        : booking.totalPrice - (booking.paidAmount || 0);

      if (paymentAmount <= 0) continue;

      booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
      booking.paymentRefs = booking.paymentRefs || [];
      booking.paymentRefs.push({
        provider: provider,
        ref: `BULK_${Date.now()}_${booking._id}`,
        amount: paymentAmount,
        at: new Date(),
        note: note || "Bulk update by Admin",
      });

      // Update trạng thái
      if (
        !booking.depositPaid &&
        paymentAmount >= (booking.depositAmount || 0)
      ) {
        booking.depositPaid = true;
      }

      if (booking.paidAmount >= booking.totalPrice) {
        booking.bookingStatus = "c";
      }

      await booking.save();
      updated.push(booking);
    }

    res.json({
      message: `Updated ${updated.length} bookings successfully`,
      count: updated.length,
      bookings: updated,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 13. ADMIN: Hoàn tiền (Refund) - Thêm luôn cho đủ bộ Admin
export const refundBookingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundAmount, reason, refundRef } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.paidAmount === 0) {
      return res
        .status(400)
        .json({ message: "Nothing to refund (Paid amount is 0)" });
    }

    const amount = Number(refundAmount) || booking.paidAmount;
    if (amount > booking.paidAmount) {
      return res
        .status(400)
        .json({ message: "Refund amount exceeds paid amount" });
    }

    // Trừ tiền
    booking.paidAmount = Math.max(0, booking.paidAmount - amount);
    booking.paymentRefs = booking.paymentRefs || [];
    booking.paymentRefs.push({
      provider: "refund",
      ref: refundRef || `REFUND_${Date.now()}`,
      amount: -amount, // Số âm thể hiện hoàn tiền
      at: new Date(),
      note: reason || "Admin refund",
    });

    // Cập nhật lại trạng thái nếu bị hụt tiền
    if (booking.paidAmount < booking.totalPrice) {
      // Nếu đang là 'completed' mà hoàn tiền -> quay về 'pending'
      if (booking.bookingStatus === "c") booking.bookingStatus = "p";

      // Nếu số tiền còn lại nhỏ hơn cọc -> mất trạng thái cọc
      if (booking.paidAmount < (booking.depositAmount || 0))
        booking.depositPaid = false;
    }

    await booking.save();

    res.json({
      message: "Refund processed successfully",
      booking,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getAdminBookingByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const booking = await Booking.findOne({ code })
      .populate(
        "tourId",
        "title destination startDate endDate priceAdult priceChild"
      )
      .populate("userId", "fullName username email avatarUrl");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 15. ADMIN: Xem lịch sử thanh toán chi tiết của 1 đơn
export const getPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id)
      .select("code paymentMethod paymentRefs paidAmount totalPrice")
      .lean();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({
      booking: {
        id: booking._id,
        code: booking.code,
        paymentMethod: booking.paymentMethod,
        totalPrice: booking.totalPrice,
        paidAmount: booking.paidAmount || 0,
        remaining: (booking.totalPrice || 0) - (booking.paidAmount || 0),
      },
      paymentHistory: booking.paymentRefs || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
