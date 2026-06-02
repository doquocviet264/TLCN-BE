import { Booking } from "../models/Booking.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { ProvinceProgress } from "../models/ProvinceProgress.js";
import { TravelMemory } from "../models/TravelMemory.js";

const normalizeProvinceName = (name) => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const hasObjectId = (items = [], id) =>
  items.some((item) => item?.toString() === id?.toString());

/**
 * Tự động mở khoá hành trình (tỉnh) cho tất cả khách hàng
 * thuộc chuyến đi (Departure) vừa được đánh dấu là hoàn thành (finished/completed).
 *
 * @param {string} departureId - ID của chuyến đi vừa hoàn thành
 */
export const unlockProvinceForDeparture = async (departureId) => {
  try {
    // 1. Lấy thông tin Departure và Tour (chứa provinceName / destination)
    const departure = await TourDeparture.findById(departureId).populate({
      path: "tourId",
      select: "title destination images",
    });

    if (!departure || !departure.tourId || !departure.tourId.destination) {
      console.warn(
        `[JourneyService] Bỏ qua mở khoá: Departure ${departureId} không tồn tại hoặc Tour không có trường destination.`
      );
      return;
    }

    const provinceName = departure.tourId.destination;
    const normalizedProvinceName = normalizeProvinceName(provinceName);
    const tourTitle = departure.tourId.title;
    const tourId = departure.tourId._id;

    // 2. Tìm tất cả các Booking đã thanh toán đầy đủ ("completed") của chuyến này
    const completedBookings = await Booking.find({
      tourDepartureId: departureId,
      bookingStatus: "completed",
      userId: { $ne: null },
    });

    if (!completedBookings || completedBookings.length === 0) {
      return;
    }

    // 3. Với mỗi user có booking completed, ta mở khoá ProvinceProgress
    for (const booking of completedBookings) {
      const userId = booking.userId;

      // Tìm ProvinceProgress hiện tại
      let progress = await ProvinceProgress.findOne({
        userId,
        normalizedProvinceName,
      });

      if (!progress) {
        // Tạo mới hoàn toàn (chưa từng đi hoặc tự đánh dấu)
        progress = new ProvinceProgress({
          userId,
          provinceName,
          normalizedProvinceName,
          source: "tour",
          unlockedAt: new Date(),
          completedBookingIds: [booking._id],
          completedTourIds: [tourId],
        });
        await progress.save();
      } else {
        // Đã tồn tại (do tự đánh dấu trước đó, hoặc đã đi tour khác tới tỉnh này)
        if (progress.source === "manual") {
          progress.source = "both";
        }
        
        // Tránh duplicate id trong mảng
        if (!hasObjectId(progress.completedBookingIds, booking._id)) {
          progress.completedBookingIds.push(booking._id);
        }
        if (!hasObjectId(progress.completedTourIds, tourId)) {
          progress.completedTourIds.push(tourId);
        }
        
        // Cập nhật ngày mở khoá theo tour nếu source chỉ có manual
        // Hoặc cứ update ngày unlockedAt mới nhất (tuỳ business logic, MVP giữ nguyên ngày gốc hoặc ngày tour)
        await progress.save();
      }

      // Tạo một Memory hệ thống mặc định để báo hiệu người dùng vừa đi tour
      // (User có thể sửa hoặc thêm ảnh sau)
      const existingSystemMemory = await TravelMemory.findOne({
        userId,
        bookingId: booking._id,
        source: "tour",
      });

      if (!existingSystemMemory) {
        const tourImages = Array.isArray(departure.tourId.images)
          ? departure.tourId.images.filter(Boolean).slice(0, 3)
          : [];
        const newMemory = new TravelMemory({
          userId,
          provinceName,
          normalizedProvinceName,
          visitedAt: new Date(), // lấy ngày kết thúc tour
          caption: `Đã hoàn thành chuyến đi: ${tourTitle}`,
          images: tourImages.length > 0 ? tourImages : ["/tour.jpg"],
          privacy: "private",
          source: "tour",
          tourId,
          bookingId: booking._id,
          isVerifiedByTour: true,
        });
        await newMemory.save();
      }
    }

    console.log(`[JourneyService] Đã mở khoá tỉnh ${provinceName} cho ${completedBookings.length} khách hàng.`);
  } catch (error) {
    console.error("[JourneyService] Lỗi khi mở khoá hành trình tự động:", error);
  }
};
