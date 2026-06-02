import { sendMail } from "./mailer.js";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";
import { getTourConfirmedTemplate } from "../utils/emailTemplates.js";

/**
 * Gửi email "Tour đã xác nhận khởi hành" cho tất cả khách đã cọc của tour.
 */
export async function notifyTourConfirmed(tourId) {
  const tour = await Tour.findById(tourId).lean();
  if (!tour) return;

  // Lấy booking đã cọc (depositPaid=true), còn trạng thái pending
  const bookings = await Booking.find({
    tourId,
    depositPaid: true,
    bookingStatus: "p",
  }).lean();

  await Promise.all(
    bookings.map(async (b) => {
      if (!b.email) return;

      await sendMail({
        to: b.email,
        subject: `Tour ${tour.title} đã xác nhận khởi hành — AHH Travel`,
        html: getTourConfirmedTemplate(b, tour),
      });
    })
  );
}
