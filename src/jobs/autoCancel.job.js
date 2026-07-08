import cron from "node-cron";
import { Booking } from "../models/Booking.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Notification } from "../models/Notification.js";
import { sendMail } from "../services/mailer.js";

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

const notifyCancel = async (booking, reason) => {
  // In-app notification
  try {
    await Notification.create({
      type: "booking",
      title: "Đơn đặt tour đã bị hủy",
      message: `Đơn đặt tour #${booking.code} của bạn đã bị hệ thống tự động hủy. Lý do: ${reason}.`,
      userId: booking.userId,
      relatedId: booking._id,
      isRead: false
    });
  } catch (err) {
    console.error("Failed to create in-app notification:", err);
  }

  // Email notification
  if (booking.email) {
    const subject = `Đơn đặt tour #${booking.code} đã bị hủy — AHH Travel`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2>Xin chào ${booking.fullName || "bạn"},</h2>
        <p>Đơn đặt tour <strong>#${booking.code}</strong> của bạn đã bị hệ thống tự động hủy.</p>
        <p><strong>Lý do:</strong> ${reason}</p>
        <p>Nếu bạn đã thanh toán cọc, số tiền cọc sẽ không được hoàn lại theo quy định của chúng tôi. Nếu bạn có thắc mắc, vui lòng liên hệ với bộ phận hỗ trợ khách hàng.</p>
        <br/>
        <p>Trân trọng,</p>
        <p><strong>Đội ngũ AHH Travel</strong></p>
      </div>
    `;
    try {
      await sendMail({ to: booking.email, subject, html });
    } catch (error) {
      console.error(`Failed to send cancel email to ${booking.email}:`, error);
    }
  }
};

export const registerAutoCancelJobs = () => {
  // Chạy định kỳ mỗi giờ
  cron.schedule("0 * * * *", async () => {
    console.log("[CRON] Running auto-cancel job...");
    try {
      const now = new Date();
      let pendingCount = 0;
      let depositCount = 0;

      // 1. Hủy đơn pending quá hạn 24h
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const pendingBookings = await Booking.find({
        bookingStatus: "pending",
        createdAt: { $lt: oneDayAgo }
      });

      for (const bk of pendingBookings) {
        bk.bookingStatus = "cancelled";
        bk.cancelReason = "Quá hạn thanh toán 24h";
        await bk.save();

        const guestsToRelease = (bk.numAdults || 0) + (bk.numChildren || 0);
        await releaseDepartureSlots(bk.tourDepartureId, guestsToRelease);
        await notifyCancel(bk, "Quá hạn thanh toán 24h");
        pendingCount++;
      }

      // 2. Hủy đơn đã cọc nhưng chưa thanh toán đủ trước ngày đi 1 ngày
      const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const depositBookings = await Booking.find({
        bookingStatus: { $in: ["confirmed", "pending"] },
        depositPaid: true,
        $expr: { $lt: ["$paidAmount", "$totalPrice"] }
      }).populate("tourDepartureId");

      for (const bk of depositBookings) {
        if (bk.tourDepartureId && bk.tourDepartureId.startDate) {
          const startDate = new Date(bk.tourDepartureId.startDate);
          // Hủy nếu ngày khởi hành nằm trong vòng 24h tới
          if (startDate < inOneDay && startDate > now) {
            bk.bookingStatus = "cancelled";
            bk.cancelReason = "Không thanh toán đủ trước ngày đi";
            await bk.save();

            const guestsToRelease = (bk.numAdults || 0) + (bk.numChildren || 0);
            await releaseDepartureSlots(bk.tourDepartureId._id, guestsToRelease);
            await notifyCancel(bk, "Không thanh toán đủ trước ngày đi");
            depositCount++;
          }
        }
      }

      console.log(`[CRON] Auto-cancelled ${pendingCount} pending bookings and ${depositCount} deposit bookings.`);
    } catch (error) {
      console.error("[CRON] Error running auto-cancel job:", error);
    }
  });
};
