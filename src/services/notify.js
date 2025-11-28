import { sendMail } from "./mailer.js";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";

/**
 * Gửi email "Tour đã xác nhận" cho tất cả khách đã cọc của tour.
 * Mỗi email kèm CTA thanh toán phần còn lại (link FE).
 */
export async function notifyTourConfirmed(tourId) {
  const tour = await Tour.findById(tourId).lean();
  if (!tour) return;

  // Lấy booking đã cọc (depositPaid=true), còn trạng thái pending (p)
  const bookings = await Booking.find({
    tourId,
    depositPaid: true,
    bookingStatus: "p"
  }).lean();

  const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

  await Promise.all(bookings.map(async (b) => {
    const remain = Math.max(0, (b.totalPrice || 0) - (b.paidAmount || 0));
    const linkPayRemaining = `${FRONTEND}/pay-remaining?code=${encodeURIComponent(b.code)}&amount=${remain}`;

    const html = `
      <p>Xin chào ${b.fullName || "Quý khách"},</p>
      <p>Tour <b>${tour.title}</b> khởi hành ngày <b>${new Date(tour.startDate).toLocaleDateString()}</b> đã <b>xác nhận khởi hành</b> (đủ số lượng khách).</p>
      <p>Vui lòng thanh toán phần còn lại: <b>${remain.toLocaleString()} VND</b>.</p>
      <p><a href="${linkPayRemaining}" target="_blank" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">Thanh toán phần còn lại</a></p>
      <p>Cảm ơn bạn đã đồng hành!</p>
    `;

    if (b.email) {
      await sendMail({
        to: b.email,
        subject: `Tour ${tour.title} đã xác nhận khởi hành`,
        html
      });
    }
  }));
}
