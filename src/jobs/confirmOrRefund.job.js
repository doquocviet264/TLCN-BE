import cron from "node-cron";
import { Tour } from "../models/Tour.js";
import { Booking } from "../models/Booking.js";
import { sendMail } from "../services/mailer.js";

/**
 * 09:00 hằng ngày:
 * - Nếu tour ngày mai đủ khách: nhắc khách thanh toán phần còn lại
 * - Nếu chưa đủ: gửi thông báo lựa chọn (hoàn cọc/chuyển tour)
 */
export function registerConfirmOrRefundJob() {
  cron.schedule("0 9 * * *", async () => {
    const today = new Date();
    const target = new Date(today);
    target.setDate(target.getDate() + 1);

    const start = new Date(target); start.setHours(0,0,0,0);
    const end   = new Date(target); end.setHours(23,59,59,999);

    const tours = await Tour.find({ startDate: { $gte: start, $lte: end } });

    for (const tour of tours) {
      const bookings = await Booking.find({ tourId: tour._id, bookingStatus: { $in: ["p","c"] } });

      if (tour.current_guests >= tour.min_guests) {
        if (tour.status !== "confirmed") {
          tour.status = "confirmed";
          await tour.save();
        }
        // nhắc thanh toán phần còn lại
        for (const bk of bookings) {
          if (bk.depositPaid && bk.bookingStatus === "p") {
            const rest = Math.max((bk.totalPrice || 0) - (bk.paidAmount || 0), 0);
            if (bk.email) {
              await sendMail({
                to: bk.email,
                subject: "Tour xác nhận khởi hành — thanh toán phần còn lại",
                html: `<p>Đơn <b>${bk.code}</b> đã đủ khách. Vui lòng thanh toán số tiền còn lại: <b>${rest}</b>.</p>`
              });
            }
            // (tuỳ chính sách) chuyển 'p' -> 'c' khi đã xác nhận chạy
            await Booking.updateOne({ _id: bk._id }, { $set: { bookingStatus: "c" } });
          }
        }
      } else {
        // chưa đủ khách
        for (const bk of bookings) {
          if (bk.depositPaid && bk.bookingStatus === "p" && bk.email) {
            await sendMail({
              to: bk.email,
              subject: "Tour chưa đủ khách",
              html: `<p>Đơn <b>${bk.code}</b> hiện tour chưa đủ khách.
              Bạn có thể chọn <b>Hoàn tiền cọc</b> hoặc <b>Chuyển sang tour khác</b> (ưu đãi thêm).</p>`
            });
          }
        }
      }
    }
  });
}
