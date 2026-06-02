import { Checkin } from "../models/Checkin.js";
import { Booking } from "../models/Booking.js";
import { ProvinceProgress } from "../models/ProvinceProgress.js";
import { TravelMemory } from "../models/TravelMemory.js";

const getJourneyData = async (userId) => {
  // Đọc dữ liệu từ bản mới (ProvinceProgress) thay vì Checkin cũ
  const progresses = await ProvinceProgress.find({ userId }).lean();

  const fromBookings = [];
  const fromManualCheckins = [];
  const progressList = [];

  for (const p of progresses) {
    if (p.source === "tour" || p.source === "both") {
      fromBookings.push(p.provinceName);
    }
    if (p.source === "manual" || p.source === "both") {
      fromManualCheckins.push(p.provinceName);
    }

    // Đếm số kỷ niệm (có thể làm aggregation, nhưng MVP query trực tiếp tạm)
    const memoryCount = await TravelMemory.countDocuments({
      userId,
      normalizedProvinceName: p.normalizedProvinceName,
    });

    progressList.push({
      provinceName: p.provinceName,
      source: p.source,
      unlockedAt: p.unlockedAt,
      memoryCount: memoryCount,
      completedTourCount: p.completedTourIds?.length || 0,
    });
  }

  // Fallback: Lấy chi tiết booking cũ để tương thích với API hiện tại
  const bookingCheckins = await Booking.find({
    userId,
    bookingStatus: "completed",
  })
    .populate({
      path: "tourDepartureId",
      select: "tourId startDate endDate status",
      populate: {
        path: "tourId",
        select: "title destination destinationSlug",
      },
    })
    .select("code tourDepartureId bookingStatus createdAt")
    .lean();

  const bookingDetails = bookingCheckins
    .map((booking) => {
      const departure = booking.tourDepartureId;
      const tour = departure?.tourId;
      if (!["completed", "closed"].includes(departure?.status)) return null;
      return {
        bookingCode: booking.code,
        provinceName: tour?.destination,
        tourTitle: tour?.title,
        destinationSlug: tour?.destinationSlug,
        startDate: departure?.startDate,
        endDate: departure?.endDate,
      };
    })
    .filter((item) => item?.provinceName);

  return { fromBookings, fromManualCheckins, bookingDetails, progress: progressList };
};

export const getUserJourney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromBookings, fromManualCheckins } = await getJourneyData(userId);
    const provinces = [...new Set([...fromBookings, ...fromManualCheckins])];

    res.json({
      total: provinces.length,
      provinces,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy dữ liệu hành trình" });
  }
};

export const getFullJourney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromBookings, fromManualCheckins, bookingDetails, progress } =
      await getJourneyData(userId);

    res.json({
      fromBookings,
      fromManualCheckins,
      bookingDetails,
      progress,
      total: new Set([...fromBookings, ...fromManualCheckins]).size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy dữ liệu hành trình" });
  }
};

export const createCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provinceName, note, type = "manual" } = req.body;

    if (!provinceName) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp tên tỉnh thành" });
    }

    const existingCheckin = await Checkin.findOne({ userId, provinceName });
    if (existingCheckin) {
      return res.status(400).json({
        message: `Bạn đã check-in tại ${provinceName} rồi!`,
      });
    }

    const shouldIssueVoucher = type !== "manual_no_voucher";
    const checkinType = type === "auto" ? "auto" : "manual";

    const shortName = provinceName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "")
      .substring(0, 3)
      .toUpperCase();

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const voucherCode = shouldIssueVoucher ? `VN-${shortName}-${randomNum}` : undefined;

    const newCheckin = new Checkin({
      userId,
      provinceName,
      type: checkinType,
      note,
      voucherCode,
      isUsed: false,
    });

    await newCheckin.save();

    res.status(201).json({
      message: "Check-in thành công!",
      data: newCheckin,
      voucherCode,
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

export const getMyVouchers = async (req, res) => {
  try {
    const userId = req.user.id;

    const vouchers = await Checkin.find({
      userId,
      voucherCode: { $exists: true, $ne: null },
    })
      .select("provinceName voucherCode createdAt isUsed")
      .sort({ createdAt: -1 });

    res.json({ data: vouchers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
