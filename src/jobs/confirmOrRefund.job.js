import cron from "node-cron";
import { TourDeparture } from "../models/TourDeparture.js";
import { Booking } from "../models/Booking.js";
import { sendMail } from "../services/mailer.js";

/**
 * 09:00 hằng ngày:
 * - Với các departure ngày mai có đủ khách: nhắc khách confirmed thanh toán phần còn lại
 * - Với departure chưa đủ khách: gửi thông báo lựa chọn (hoàn cọc/chuyển tour)
 */
export function registerConfirmOrRefundJob() {
  cron.schedule("0 9 * * *", async () => {
    const today = new Date();
    const target = new Date(today);
    target.setDate(target.getDate() + 1);

    const start = new Date(target); start.setHours(0,0,0,0);
    const end   = new Date(target); end.setHours(23,59,59,999);

    const departures = await TourDeparture.find({ startDate: { $gte: start, $lte: end } });

    for (const departure of departures) {
      const bookings = await Booking.find({
        tourDepartureId: departure._id,
        bookingStatus: { $in: ["pending", "confirmed"] }
      });

      if ((departure.current_guests || 0) >= (departure.min_guests || 0)) {
        // Đủ khách: nhắc thanh toán phần còn lại
        for (const bk of bookings) {
          if (bk.depositPaid && bk.bookingStatus === "confirmed") {
            const rest = Math.max((bk.totalPrice || 0) - (bk.paidAmount || 0), 0);
            if (rest > 0 && bk.email) {
              await sendMail({
                to: bk.email,
                subject: "Tour xác nhận khởi hành — thanh toán phần còn lại",
                html: `<p>Đơn <b>${bk.code}</b> đã đủ khách. Vui lòng thanh toán số tiền còn lại: <b>${rest.toLocaleString("vi-VN")} VNĐ</b>.</p>`
              });
            }
          }
        }
      } else {
        // Chưa đủ khách: thông báo
        for (const bk of bookings) {
          if (bk.depositPaid && bk.email) {
            await sendMail({
              to: bk.email,
              subject: "Tour chưa đủ khách",
              html: `<p>Đơn <b>${bk.code}</b> hiện tour chưa đủ khách. Bạn có thể chọn <b>Hoàn tiền cọc</b> hoặc <b>Chuyển sang tour khác</b> (ưu đãi thêm).</p>`
            });
          }
        }
      }
    }
  });
}
