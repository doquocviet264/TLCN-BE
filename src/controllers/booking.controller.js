import mongoose from "mongoose";
import { Tour } from "../models/Tour.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Booking } from "../models/Booking.js";
import { Voucher } from "../models/Voucher.js";
import { validateVoucherInternal } from "./voucher.controller.js";
import { sendMail } from "../services/mailer.js";
import { notifyTourConfirmed } from "../services/notify.js";
import {
  getBookingCreatedTemplate,
  getPaymentReceiptTemplate,
} from "../utils/emailTemplates.js";
import { Notification } from "../models/Notification.js";

// Helper: Trả lại slot và hoàn tác trạng thái nếu dưới min_guests
const releaseDepartureSlots = async (departureId, guestsToRelease) => {
  if (!departureId || guestsToRelease <= 0) return;
  const dep = await TourDeparture.findByIdAndUpdate(
    departureId,
    { $inc: { current_guests: -guestsToRelease } },
    { new: true }
  );
  if (dep && dep.status === "confirmed" && dep.current_guests < (dep.min_guests || 0)) {
    dep.status = "pending";
    await dep.save();
  }
};

// 1. Tạo Booking Mới (Gửi mail xác nhận đặt tour)
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.startTransaction();

    let tourDepartureId,
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
      tourDepartureId = tId; // FE gửi departureId vào đây
      numAdults = guests?.adults || 1;
      numChildren = guests?.children || 0;
      fullName = contact?.fullName;
      email = contact?.email;
      phoneNumber = contact?.phone;
      address = contact?.address;
      note = req.body.note;
    } else {
      const data = req.body;
      tourDepartureId = data.tourId; // FE gửi departureId vào đây
      numAdults = data.numAdults || 1;
      numChildren = data.numChildren || 0;
      fullName = data.fullName;
      email = data.email;
      phoneNumber = data.phoneNumber;
      address = data.address;
      note = data.note;
    }

    if (!mongoose.isValidObjectId(tourDepartureId)) {
      return res.status(400).json({ message: "Invalid tourDepartureId" });
    }

    // Tìm lịch khởi hành (Departure)
    const departure = await TourDeparture.findById(tourDepartureId).populate("tourId").session(session);
    if (!departure) return res.status(404).json({ message: "Lịch khởi hành không tồn tại" });
    
    if (departure.status === "closed")
      return res.status(400).json({ message: "Lịch khởi hành này đã đóng" });

    // Validate deposit rules
    const diffDays = departure.startDate ? Math.ceil((new Date(departure.startDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 999;
    if (req.body.paymentType === "deposit" && diffDays < 3) {
      return res.status(400).json({ message: "Không thể đặt cọc khi ngày khởi hành còn dưới 3 ngày, vui lòng thanh toán toàn bộ." });
    }

    const tour = departure.tourId;
    if (!tour) return res.status(404).json({ message: "Dữ liệu tour không tìm thấy" });

    // Validate số lượng khách
    const guestsRequested = (Number(numAdults) || 0) + (Number(numChildren) || 0);
    if (guestsRequested <= 0)
      return res.status(400).json({ message: "Số lượng khách không hợp lệ" });

    // Check slot còn trống dựa trên Departure
    if (Number.isFinite(departure.max_guests)) {
      const after = (departure.current_guests || 0) + guestsRequested;
      if (after > departure.max_guests) {
        return res.status(400).json({
          message: "Lịch khởi hành này đã hết chỗ",
          available: Math.max(0, (departure.max_guests || 0) - (departure.current_guests || 0)),
        });
      }
    }

    // Tính toán giá tiền (Ưu tiên giá override ở Departure)
    const priceAdult = departure.priceAdult ?? tour.priceAdult ?? 0;
    const priceChild = departure.priceChild ?? tour.priceChild ?? Math.round(priceAdult * 0.6);
    let totalPrice = Number(numAdults) * priceAdult + Number(numChildren) * priceChild;

    // Xử lý Voucher (nếu có)
    let voucherCode = null;
    let discountAmount = 0;
    if (req.body.couponCode) {
      try {
        const vResult = await validateVoucherInternal(req.body.couponCode, totalPrice, tour._id);
        voucherCode = vResult.voucher.code;
        discountAmount = vResult.discountAmount;
        totalPrice = Math.max(0, totalPrice - discountAmount);
        
        // Tăng số lượt sử dụng voucher
        await Voucher.updateOne(
          { _id: vResult.voucher._id },
          { $inc: { usedCount: 1 } },
          { session }
        );
      } catch (vErr) {
        // Nếu voucher lỗi, trả về lỗi ngay không cho đặt chỗ
        return res.status(400).json({ message: vErr.message });
      }
    }

    const code = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // Tạo booking liên kết với tourDepartureId
    const [booking] = await Booking.create(
      [
        {
          code,
          tourDepartureId,
          userId: req.user.id,
          fullName,
          email,
          phoneNumber,
          address,
          note,
          numAdults,
          numChildren,
          priceAdultSnapshot: priceAdult,
          priceChildSnapshot: priceChild,
          totalPrice,
          voucherCode,
          discountAmount,
          bookingStatus: "pending",
          paymentMethod: req.body.paymentMethod || "momo",
          paidAmount: 0,
          depositPaid: false,
          paymentRefs: [],
        },
      ],
      { session }
    );

    // Cập nhật số khách vào Departure
    await TourDeparture.updateOne(
      { _id: tourDepartureId },
      { $inc: { current_guests: guestsRequested } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // --- GỬI EMAIL XÁC NHẬN ---
    if (booking.email) {
      sendMail({
        to: booking.email,
        subject: `✅ Xác nhận đặt tour: ${tour.title} (#${booking.code})`,
        html: getBookingCreatedTemplate(booking, tour),
      }).catch((err) => console.error("Send booking mail error:", err));
    }
    // ------------------------------------
    
    // --- TẠO THÔNG BÁO ---
    if (booking.userId) {
      Notification.create({
        type: "booking",
        title: "Đặt tour thành công",
        content: `Bạn đã đặt thành công tour "${tour.title}". Mã đơn: ${booking.code}. Vui lòng thanh toán để giữ chỗ.`,
        link: `/user/history`,
        targetType: "user",
        targetUsers: [booking.userId],
        targetTourId: tour._id,
      }).catch((err) => console.error("Create notification error:", err));
    }
    // ---------------------

    return res.status(201).json({
      message: "Booking created successfully",
      code: booking.code,
      total: booking.totalPrice,
      depositAmount: Math.round(booking.totalPrice * 0.5),
      booking,
    });
  } catch (err) {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch { }
    try {
      session.endSession();
    } catch { }
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

    // Logic trạng thái: cọc ≥ 50% → confirmed, đủ 100% → completed
    const depositThreshold = booking.totalPrice * 0.5;
    if (!booking.depositPaid && booking.paidAmount >= depositThreshold) {
      booking.depositPaid = true;
      if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
    }
    if (booking.paidAmount >= booking.totalPrice) {
      booking.bookingStatus = "completed";
    }

    await booking.save();

    // --- GỬI EMAIL BIÊN LAI THANH TOÁN ---
    if (booking.email && Number(amount) > 0) {
      sendMail({
        to: booking.email,
        subject: `💸 Xác nhận thanh toán - Đơn #${booking.code}`,
        html: getPaymentReceiptTemplate(booking, Number(amount)),
      }).catch((err) => console.error("Send payment mail error:", err));
    }
    // -------------------------------------

    // Auto confirm departure nếu đủ khách
    if (isFirstDeposit) {
      const departure = await TourDeparture.findById(booking.tourDepartureId);
      if (
        departure &&
        (departure.current_guests || 0) >= (departure.min_guests || 0) &&
        departure.status !== "confirmed" &&
        departure.status !== "in_progress" &&
        departure.status !== "completed"
      ) {
        departure.status = "confirmed";
        await departure.save();
        await notifyTourConfirmed(departure.tourId).catch(console.error);
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
  const { status, search } = req.query;

  const query = { userId: req.user.id };

  // Filter by status
  if (status && status !== "all") {
    query.bookingStatus = status;
  }

  // Search by code or title
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { code: searchRegex },
      { fullName: searchRegex },
      // Note: searching by tour title would require a more complex lookup if not populated yet
      // but we can search in populated fields if we use aggregate or separate query
    ];
  }

  let [rows, total] = await Promise.all([
    Booking.find(query)
      .populate({
        path: "tourDepartureId",
        populate: {
          path: "tourId",
          select: "title destination startDate endDate cover images time priceAdult priceChild"
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(query),
  ]);

  rows = rows.map((b) => {
    if (b.tourDepartureId) {
      b.tourId = {
        _id: b.tourDepartureId.tourId?._id || b.tourDepartureId.tourId,
        title: b.tourDepartureId.tourId?.title,
        destination: b.tourDepartureId.tourId?.destination,
        startDate: b.tourDepartureId.startDate,
        endDate: b.tourDepartureId.endDate,
        cover: b.tourDepartureId.tourId?.cover,
        images: b.tourDepartureId.tourId?.images,
        time: b.tourDepartureId.tourId?.time,
        priceAdult: b.tourDepartureId.priceAdult || b.tourDepartureId.tourId?.priceAdult,
        priceChild: b.tourDepartureId.priceChild || b.tourDepartureId.tourId?.priceChild,
      };
    }
    return b;
  });

  res.json({ total, page, limit, data: rows });
};

// 4. Hủy đơn (User)
export const cancelBookingByUser = async (req, res) => {
  const { code } = req.params;
  const bk = await Booking.findOne({ code, userId: req.user.id });

  if (!bk) return res.status(404).json({ message: "Booking not found" });
  if (bk.bookingStatus !== "pending") {
    return res
      .status(400)
      .json({ message: "Only pending bookings can be canceled" });
  }

  bk.bookingStatus = "cancelled";
  await bk.save();

  // Trả lại slot khi hủy booking ở Departure
  const guestsToRelease = (bk.numAdults || 0) + (bk.numChildren || 0);
  await releaseDepartureSlots(bk.tourDepartureId, guestsToRelease);

  // Có thể thêm gửi mail thông báo hủy ở đây nếu muốn

  res.json({ message: "Canceled", booking: bk });
};

// 5. Chi tiết đơn hàng (User)
export const getMyBookingDetail = async (req, res) => {
  try {
    const { code } = req.params;
    const booking = await Booking.findOne({ code, userId: req.user.id })
      .populate({
        path: "tourDepartureId",
        populate: {
          path: "tourId",
          select: "title destination startDate endDate images time priceAdult priceChild status itinerary"
        }
      })
      .lean();

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    let mappedTour = null;
    if (booking.tourDepartureId) {
      mappedTour = {
        id: booking.tourDepartureId.tourId?._id || booking.tourDepartureId.tourId,
        title: booking.tourDepartureId.tourId?.title,
        destination: booking.tourDepartureId.tourId?.destination,
        startDate: booking.tourDepartureId.startDate,
        endDate: booking.tourDepartureId.endDate,
        time: booking.tourDepartureId.tourId?.time,
        status: booking.tourDepartureId.tourId?.status,
        images: booking.tourDepartureId.tourId?.images || [],
        itinerary: booking.tourDepartureId.tourId?.itinerary || [],
        priceAdult: booking.tourDepartureId.priceAdult || booking.tourDepartureId.tourId?.priceAdult,
        priceChild: booking.tourDepartureId.priceChild || booking.tourDepartureId.tourId?.priceChild
      };
      
      booking.tourId = mappedTour;
    }

    res.json({
      ...booking,
      tour: mappedTour,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// 6. Admin: Lấy danh sách Booking (Có lọc nâng cao)
export const getAdminBookings = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const skip = (page - 1) * limit;

    const { 
      status, 
      tourId, 
      departureId,
      search, 
      startDate, 
      endDate, 
      paymentStatus, 
      customerType, 
      paymentMethod 
    } = req.query;

    const filter = {};

    // 1. Lọc theo trạng thái đơn hàng (pending, confirmed, etc.)
    if (status && status.trim()) {
      filter.bookingStatus = status;
    }

    // 2. Lọc theo Tour Template cụ thể
    if (tourId && mongoose.isValidObjectId(tourId)) {
      // Tìm tất cả các departure của tour này
      const departuresOfTour = await TourDeparture.find({ tourId }).select("_id");
      const departureIds = departuresOfTour.map(d => d._id);
      filter.tourDepartureId = { $in: departureIds };
    }

    // 2.1 Lọc theo một Departure cụ thể (Mới bổ sung)
    if (departureId && mongoose.isValidObjectId(departureId)) {
      filter.tourDepartureId = departureId;
    }

    // 3. Lọc theo khoảng ngày khởi hành (Departure Date Range)
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = eDate;
      }
      
      const matchingDepartures = await TourDeparture.find({ 
        startDate: dateFilter 
      }).select("_id");
      
      const matchingDepartureIds = matchingDepartures.map(d => d._id);
      
      if (filter.tourDepartureId) {
        // Nếu đã có lọc tourId, lấy giao điểm
        const existingIds = filter.tourDepartureId.$in.map(id => id.toString());
        const intersection = matchingDepartureIds.filter(id => existingIds.includes(id.toString()));
        filter.tourDepartureId = { $in: intersection };
      } else {
        filter.tourDepartureId = { $in: matchingDepartureIds };
      }
    }

    // 4. Lọc theo tình trạng thanh toán
    if (paymentStatus) {
      switch (paymentStatus) {
        case "unpaid":
          filter.paidAmount = 0;
          break;
        case "deposited":
          // Đã trả > 0 nhưng chưa đủ 100%
          filter.$and = filter.$and || [];
          filter.$and.push({ paidAmount: { $gt: 0 } });
          filter.$and.push({ $expr: { $lt: ["$paidAmount", "$totalPrice"] } });
          break;
        case "full":
          filter.$expr = { $gte: ["$paidAmount", "$totalPrice"] };
          break;
      }
    }

    // 5. Lọc theo loại khách hàng
    if (customerType) {
      if (customerType === "member") {
        filter.userId = { $ne: null };
      } else if (customerType === "guest") {
        filter.userId = null;
      }
    }

    // 6. Lọc theo phương thức thanh toán
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    // 7. Tìm kiếm (fullName, email, code, phone)
    if (search && search.trim()) {
      const s = search.trim();
      const searchRegex = { $regex: s, $options: "i" };
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { code: searchRegex },
        { phoneNumber: searchRegex },
      ];
    }

    const total = await Booking.countDocuments(filter);
    let bookings = await Booking.find(filter)
      .populate({
        path: "tourDepartureId",
        populate: {
          path: "tourId",
          select: "title destination",
        },
      })
      .populate("userId", "fullName username email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mapping lại dữ liệu để tương thích với FE
    bookings = bookings.map((b) => {
      if (b.tourDepartureId) {
        b.tourId = {
          _id: b.tourDepartureId.tourId?._id || b.tourDepartureId.tourId,
          title: b.tourDepartureId.tourId?.title,
          destination: b.tourDepartureId.tourId?.destination,
          startDate: b.tourDepartureId.startDate,
          endDate: b.tourDepartureId.endDate,
        };
      }
      return b;
    });

    res.json({ total, page, limit, data: bookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 7. Admin: Chi tiết Booking
export const getAdminBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: "tourDepartureId",
        populate: {
          path: "tourId",
          select: "title destination startDate endDate images itinerary time status"
        }
      })
      .populate("userId", "fullName email")
      .lean();
      
    if (!booking) return res.status(404).json({ message: "Not found" });
    
    if (booking.tourDepartureId) {
      booking.tourId = {
        _id: booking.tourDepartureId.tourId?._id || booking.tourDepartureId.tourId,
        title: booking.tourDepartureId.tourId?.title,
        destination: booking.tourDepartureId.tourId?.destination,
        startDate: booking.tourDepartureId.startDate,
        endDate: booking.tourDepartureId.endDate,
        images: booking.tourDepartureId.tourId?.images,
        itinerary: booking.tourDepartureId.tourId?.itinerary,
        time: booking.tourDepartureId.tourId?.time,
        status: booking.tourDepartureId.tourId?.status,
      };
    }
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 8. Admin: Tạo Booking (Khách vãng lai hoặc chọn User)
export const adminCreateBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.startTransaction();

    const {
      tourDepartureId,
      userId,
      fullName,
      email,
      phoneNumber,
      address,
      note,
      numAdults = 1,
      numChildren = 0,
      paymentMethod = "manual",
      paidAmount = 0,
    } = req.body;

    if (!mongoose.isValidObjectId(tourDepartureId)) {
      return res.status(400).json({ message: "Invalid tourDepartureId" });
    }

    const departure = await TourDeparture.findById(tourDepartureId).populate("tourId").session(session);
    if (!departure) return res.status(404).json({ message: "Lịch khởi hành không tồn tại" });
    if (departure.status === "closed") return res.status(400).json({ message: "Lịch khởi hành này đã đóng" });

    const guestsRequested = Number(numAdults) + Number(numChildren);
    if (guestsRequested <= 0) return res.status(400).json({ message: "Số lượng khách không hợp lệ" });

    if (Number.isFinite(departure.max_guests)) {
      const after = (departure.current_guests || 0) + guestsRequested;
      if (after > departure.max_guests) {
        return res.status(400).json({
          message: "Lịch khởi hành này đã hết chỗ",
          available: Math.max(0, departure.max_guests - (departure.current_guests || 0)),
        });
      }
    }

    const tour = departure.tourId;
    const priceAdult = departure.priceAdult ?? tour.priceAdult ?? 0;
    const priceChild = departure.priceChild ?? tour.priceChild ?? Math.round(priceAdult * 0.6);
    let totalPrice = Number(numAdults) * priceAdult + Number(numChildren) * priceChild;

    // Xử lý Voucher (Admin create cũng có thể áp mã)
    let voucherCodeSnapshot = null;
    let discountAmountSnapshot = 0;
    if (req.body.couponCode) {
      try {
        const vResult = await validateVoucherInternal(req.body.couponCode, totalPrice, tour._id);
        voucherCodeSnapshot = vResult.voucher.code;
        discountAmountSnapshot = vResult.discountAmount;
        totalPrice = Math.max(0, totalPrice - discountAmountSnapshot);
        
        await Voucher.updateOne(
          { _id: vResult.voucher._id },
          { $inc: { usedCount: 1 } },
          { session }
        );
      } catch (vErr) {
        return res.status(400).json({ message: `Lỗi voucher: ${vErr.message}` });
      }
    }

    const code = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // Logic payment & status cho Admin create
    let depositPaid = false;
    let bookingStatus = "pending";
    const paymentRefs = [];

    if (Number(paidAmount) > 0) {
      paymentRefs.push({
        provider: paymentMethod,
        ref: `ADMIN_${Date.now()}`,
        amount: Number(paidAmount),
        at: new Date(),
        note: "Admin created booking",
      });
      const depositThreshold = totalPrice * 0.5;
      if (paidAmount >= depositThreshold) {
        depositPaid = true;
        bookingStatus = "confirmed";
      }
      if (paidAmount >= totalPrice) {
        bookingStatus = "completed";
      }
    }

    const [booking] = await Booking.create(
      [
        {
          code,
          tourDepartureId,
          userId: userId || null, // null for walk-in
          fullName,
          email,
          phoneNumber,
          address,
          note,
          numAdults,
          numChildren,
          priceAdultSnapshot: priceAdult,
          priceChildSnapshot: priceChild,
          totalPrice,
          voucherCode: voucherCodeSnapshot,
          discountAmount: discountAmountSnapshot,
          bookingStatus,
          paymentMethod,
          paidAmount: Number(paidAmount),
          depositPaid,
          paymentRefs,
          isAdminCreated: true,
        },
      ],
      { session }
    );

    await TourDeparture.updateOne(
      { _id: tourDepartureId },
      { $inc: { current_guests: guestsRequested } },
      { session }
    );

    // Auto confirm departure if enough guests
    if (depositPaid && (departure.current_guests || 0) + guestsRequested >= (departure.min_guests || 0)) {
       if (departure.status !== "confirmed" && departure.status !== "in_progress" && departure.status !== "completed") {
         await TourDeparture.updateOne({ _id: tourDepartureId }, { $set: { status: "confirmed" } }, { session });
         notifyTourConfirmed(tour._id).catch(console.error);
       }
    }

    await session.commitTransaction();
    session.endSession();

    if (booking.email) {
      sendMail({
        to: booking.email,
        subject: `✅ Xác nhận đặt tour: ${tour.title} (#${booking.code})`,
        html: getBookingCreatedTemplate(booking, tour),
      }).catch((err) => console.error("Send booking mail error:", err));
    }

    // --- TẠO THÔNG BÁO ---
    if (booking.userId) {
      Notification.create({
        type: "booking",
        title: "Được tạo đơn đặt tour",
        content: `Admin đã tạo đơn đặt tour "${tour.title}" cho bạn. Mã đơn: ${booking.code}.`,
        link: `/user/history`,
        targetType: "user",
        targetUsers: [booking.userId],
        targetTourId: tour._id,
      }).catch((err) => console.error("Create notification error:", err));
    }
    // ---------------------

    return res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (err) {
    try { if (session.inTransaction()) await session.abortTransaction(); } catch { }
    try { session.endSession(); } catch { }
    return res.status(500).json({ message: err.message });
  }
};

// 9. Admin: Cập nhật trạng thái Booking
export const updateAdminBookingStatus = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const allowed = ["pending", "confirmed", "completed", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const oldBooking = await Booking.findById(req.params.id);
    if (!oldBooking) return res.status(404).json({ message: "Not found" });
    const oldStatus = oldBooking.bookingStatus;

    const update = { bookingStatus: status };
    if (status === "cancelled" && cancelReason) update.cancelReason = cancelReason;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    )
      .populate({
        path: "tourDepartureId",
        populate: { path: "tourId" }
      })
      .populate("userId")
      .lean();

    // Hoàn trả slot nếu trạng thái chuyển sang cancelled
    if (oldStatus !== "cancelled" && status === "cancelled") {
      const guestsToRelease = (booking.numAdults || 0) + (booking.numChildren || 0);
      await releaseDepartureSlots(booking.tourDepartureId._id || booking.tourDepartureId, guestsToRelease);
    }

    // Nếu Admin xác nhận Tour, gửi mail thông báo
    if (status === "confirmed" && booking.tourDepartureId && booking.tourDepartureId.tourId) {
      notifyTourConfirmed(booking.tourDepartureId.tourId._id).catch(console.error);
    }

    // --- TẠO THÔNG BÁO ---
    if (booking.userId) {
       let title = "";
       let content = "";
       if (status === "confirmed") {
          title = "Đơn đặt tour đã được xác nhận";
          content = `Đơn đặt tour #${booking.code} của bạn đã được Admin xác nhận.`;
       } else if (status === "cancelled") {
          title = "Đơn đặt tour đã bị hủy";
          content = `Đơn đặt tour #${booking.code} của bạn đã bị hủy. Lý do: ${cancelReason || "Không có"}. Tiến độ hoàn tiền (nếu có) sẽ được thông báo sau.`;
       }
       
       if (title) {
          Notification.create({
            type: "booking",
            title,
            content,
            link: `/user/history`,
            targetType: "user",
            targetUsers: [booking.userId._id || booking.userId],
          }).catch(console.error);
       }
    }
    // ---------------------

    if (booking.tourDepartureId) {
      booking.tourId = {
        _id: booking.tourDepartureId._id,
        title: booking.tourDepartureId.tourId?.title,
        destination: booking.tourDepartureId.tourId?.destination,
        startDate: booking.tourDepartureId.startDate,
        endDate: booking.tourDepartureId.endDate
      };
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
    // Hoàn trả slot khi xóa booking
    const guestsToRelease = (booking.numAdults || 0) + (booking.numChildren || 0);
    await releaseDepartureSlots(booking.tourDepartureId, guestsToRelease);
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

      const depositThreshold = booking.totalPrice * 0.5;
      if (!booking.depositPaid && booking.paidAmount >= depositThreshold) {
        booking.depositPaid = true;
        if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
      }
      if (booking.paidAmount >= booking.totalPrice) booking.bookingStatus = "completed";

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
      const depositThreshold2 = booking.totalPrice * 0.5;
      if (!booking.depositPaid && booking.paidAmount >= depositThreshold2) {
        booking.depositPaid = true;
        if (booking.bookingStatus === "pending") booking.bookingStatus = "confirmed";
      }
      if (booking.paidAmount >= booking.totalPrice) {
        booking.bookingStatus = "completed";
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

    const oldStatus = booking.bookingStatus;
    
    // Khi hoàn tiền, tự động chuyển trạng thái đơn sang Hủy
    booking.bookingStatus = "cancelled";
    booking.cancelReason = reason || "Hủy do hoàn tiền";
    booking.depositPaid = false;

    await booking.save();

    // Nếu đơn chưa bị hủy trước đó, hoàn trả slot lại cho lịch khởi hành
    if (oldStatus !== "cancelled") {
      const guestsToRelease = (booking.numAdults || 0) + (booking.numChildren || 0);
      await releaseDepartureSlots(booking.tourDepartureId, guestsToRelease);
    }

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
      .populate({
        path: "tourDepartureId",
        populate: {
          path: "tourId",
          select: "title destination startDate endDate priceAdult priceChild"
        }
      })
      .populate("userId", "fullName username email avatarUrl")
      .lean();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.tourDepartureId) {
      booking.tourId = {
        _id: booking.tourDepartureId._id,
        title: booking.tourDepartureId.tourId?.title,
        destination: booking.tourDepartureId.tourId?.destination,
        startDate: booking.tourDepartureId.startDate,
        endDate: booking.tourDepartureId.endDate,
        priceAdult: booking.tourDepartureId.priceAdult || booking.tourDepartureId.tourId?.priceAdult,
        priceChild: booking.tourDepartureId.priceChild || booking.tourDepartureId.tourId?.priceChild
      };
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
