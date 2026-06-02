import cron from "node-cron";
import { Booking } from "../models/Booking.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Notification } from "../models/Notification.js";

// Đăng ký các Job liên quan đến Thông báo
export const registerNotificationJobs = () => {
  // 1. Nhắc nhở thanh toán trước khi hết hạn (Mỗi giờ chạy 1 lần lúc phút 0)
  // Booking chưa thanh toán (pending), tạo cách đây <= 24h, sẽ nhắc nhở ở mốc 22h (còn 2 tiếng)
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const remindTimeLower = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23h trước
      const remindTimeUpper = new Date(now.getTime() - 21 * 60 * 60 * 1000); // 21h trước

      // Tìm booking pending, chưa đóng cọc, tạo trong khoảng 21-23 tiếng trước
      const bookings = await Booking.find({
        bookingStatus: "pending",
        depositPaid: false,
        createdAt: { $gte: remindTimeLower, $lte: remindTimeUpper },
        userId: { $ne: null },
      });

      for (const b of bookings) {
        // Tránh tạo lặp lại bằng cách check đã có thông báo loại "payment" cho booking này chưa (gần đây)
        const existNotif = await Notification.findOne({
          targetUsers: b.userId,
          title: { $regex: "Nhắc nhở thanh toán" },
          createdAt: { $gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) }, // trong vòng 4h
        });

        if (!existNotif) {
          await Notification.create({
            type: "payment",
            title: "Nhắc nhở thanh toán sắp hết hạn",
            content: `Booking #${b.code} của bạn sắp hết hạn giữ chỗ trong 2 giờ tới. Vui lòng thanh toán để xác nhận.`,
            link: `/user/history`,
            targetType: "user",
            targetUsers: [b.userId],
            targetTourId: b.tourDepartureId?.tourId || null,
          });
        }
      }
    } catch (err) {
      console.error("[CRON JOB] Payment reminder error:", err);
    }
  });

  // 2. Nhắc nhở trước ngày khởi hành (Chạy lúc 8h sáng mỗi ngày)
  // Nhắc trước 3 ngày và 24h (1 ngày)
  cron.schedule("0 8 * * *", async () => {
    try {
      const now = new Date();
      const in3DaysStart = new Date(now); in3DaysStart.setDate(in3DaysStart.getDate() + 3); in3DaysStart.setHours(0,0,0,0);
      const in3DaysEnd = new Date(now); in3DaysEnd.setDate(in3DaysEnd.getDate() + 3); in3DaysEnd.setHours(23,59,59,999);
      
      const in1DayStart = new Date(now); in1DayStart.setDate(in1DayStart.getDate() + 1); in1DayStart.setHours(0,0,0,0);
      const in1DayEnd = new Date(now); in1DayEnd.setDate(in1DayEnd.getDate() + 1); in1DayEnd.setHours(23,59,59,999);

      // Tìm Departure sắp đi trong 3 ngày
      const deps3Days = await TourDeparture.find({
        status: { $in: ["confirmed", "pending"] }, // sometimes it's confirmed
        startDate: { $gte: in3DaysStart, $lte: in3DaysEnd },
      }).populate("tourId");

      for (const d of deps3Days) {
        const bookings = await Booking.find({ tourDepartureId: d._id, bookingStatus: { $ne: "cancelled" }, userId: { $ne: null } });
        const userIds = [...new Set(bookings.map(b => b.userId.toString()))];
        if (userIds.length > 0) {
          await Notification.create({
            type: "tour",
            title: "Sắp đến ngày khởi hành (Còn 3 ngày)",
            content: `Chuyến đi "${d.tourId?.title}" của bạn sẽ khởi hành trong 3 ngày tới. Hãy chuẩn bị hành lý nhé!`,
            link: `/user/history`,
            targetType: "user",
            targetUsers: userIds,
            targetTourId: d.tourId?._id,
          });
        }
      }

      // Tìm Departure sắp đi trong 1 ngày
      const deps1Day = await TourDeparture.find({
        status: { $in: ["confirmed", "pending"] },
        startDate: { $gte: in1DayStart, $lte: in1DayEnd },
      }).populate("tourId");

      for (const d of deps1Day) {
        const bookings = await Booking.find({ tourDepartureId: d._id, bookingStatus: { $ne: "cancelled" }, userId: { $ne: null } });
        const userIds = [...new Set(bookings.map(b => b.userId.toString()))];
        if (userIds.length > 0) {
          await Notification.create({
            type: "tour",
            title: "Sắp đến ngày khởi hành (Còn 24 giờ)",
            content: `Chuyến đi "${d.tourId?.title}" của bạn sẽ khởi hành vào ngày mai. Hãy kiểm tra lại giấy tờ và điểm hẹn!`,
            link: `/user/history`,
            targetType: "user",
            targetUsers: userIds,
            targetTourId: d.tourId?._id,
          });
        }
      }

    } catch (err) {
      console.error("[CRON JOB] Departure reminder error:", err);
    }
  });

  // 3. Yêu cầu đánh giá (Review) (Chạy lúc 10h sáng mỗi ngày)
  cron.schedule("0 10 * * *", async () => {
    try {
      const now = new Date();
      // Tour kết thúc hôm qua (để gửi hôm nay)
      const yesterdayStart = new Date(now); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0,0,0,0);
      const yesterdayEnd = new Date(now); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1); yesterdayEnd.setHours(23,59,59,999);

      const finishedDeps = await TourDeparture.find({
        $or: [
          { status: "completed" },
          { endDate: { $gte: yesterdayStart, $lte: yesterdayEnd } }
        ]
      }).populate("tourId");

      for (const d of finishedDeps) {
        const bookings = await Booking.find({ tourDepartureId: d._id, bookingStatus: { $in: ["completed", "confirmed"] }, userId: { $ne: null } });
        const userIds = [...new Set(bookings.map(b => b.userId.toString()))];
        
        for (const uId of userIds) {
           // Tránh lặp lại
           const existNotif = await Notification.findOne({
             targetUsers: uId,
             targetTourId: d.tourId?._id,
             title: { $regex: "Đánh giá" },
             type: "review"
           });

           if (!existNotif && d.tourId) {
             await Notification.create({
               type: "review",
               title: "Hãy đánh giá trải nghiệm của bạn",
               content: `Chuyến đi "${d.tourId.title}" đã kết thúc. Hãy để lại đánh giá của bạn để nhận thêm ưu đãi nhé!`,
               link: `/tours/${d.tourId._id}`,
               targetType: "user",
               targetUsers: [uId],
               targetTourId: d.tourId._id,
             });
           }
        }
      }
    } catch (err) {
      console.error("[CRON JOB] Review request error:", err);
    }
  });

  console.log("[Node-Cron] Notification jobs registered.");
};
