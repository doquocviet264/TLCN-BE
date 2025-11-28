import { verifyVNPayChecksum } from "../utils/vnpay.js";
import { Booking } from "../models/Booking.js";
import { Tour } from "../models/Tour.js";
import mongoose from "mongoose";

async function markDepositAndMaybeConfirm(booking, amount) {
  booking.paidAmount = (booking.paidAmount || 0) + Number(amount || 0);
  if (!booking.depositPaid) booking.depositPaid = true;
  if ((booking.paidAmount || 0) >= (booking.totalPrice || Number.MAX_SAFE_INTEGER)) {
    booking.bookingStatus = "c";
  }
  await booking.save();

  // (tuỳ chính sách) tăng current_guests nếu đây là lần cọc đầu tiên
  const tour = await Tour.findById(booking.tourId);
  if (tour) {
    // tour.current_guests = (tour.current_guests || 0) + booking.numAdults + booking.numChildren;
    // await tour.save();

    if (tour.current_guests >= tour.min_guests && tour.status !== "confirmed") {
      tour.status = "confirmed";
      await tour.save();
      // await notifyTourConfirmed(tour._id); // nếu có
    }
  }

  return booking;
}

// Người dùng bị redirect về đây: nên redirect FE sau khi ghi nhận trạng thái
export const vnpReturn = async (req, res) => {
  try {
    const q = req.query;
    const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASH_SECRET);
    if (!ok) {
      // Sai chữ ký → không tin tưởng, chuyển về FE với trạng thái fail
      const redirect = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment?status=failed&reason=invalid_sig`;
      return res.redirect(redirect);
    }

    const code = q.vnp_TxnRef;                  // booking.code
    const rsp = q.vnp_ResponseCode;             // "00" thành công
    const payAmount = Number(q.vnp_Amount || "0")/100; // VNPAY trả *100

    const booking = await Booking.findOne({ code });
    if (!booking) {
      const redirect = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment?status=failed&reason=notfound`;
      return res.redirect(redirect);
    }

    if (rsp === "00") {
      // Idempotent: nếu đã ghi nhận ref này thì bỏ qua
      const ref = q.vnp_TransactionNo || q.vnp_TransactionStatus || Date.now().toString();
      if (!booking.paymentRefs?.some(p => p.provider === "vnpay" && p.ref === ref)) {
        booking.paymentRefs = booking.paymentRefs || [];
        booking.paymentRefs.push({ provider: "vnpay", ref, amount: payAmount, at: new Date() });
        await markDepositAndMaybeConfirm(booking, payAmount);
      }
      const redirect = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment?status=success&code=${booking.code}`;
      return res.redirect(redirect);
    } else {
      const redirect = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment?status=failed&reason=${rsp}`;
      return res.redirect(redirect);
    }
  } catch (err) {
    const redirect = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment?status=failed&reason=server`;
    return res.redirect(redirect);
  }
};
export const vnpIpn = async (req, res) => {
  try {
    const q = req.query; // VNPAY gọi dạng GET
    const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASH_SECRET);
    if (!ok) {
      return res.json({ RspCode: "97", Message: "Invalid signature" });
    }

    const code = q.vnp_TxnRef;
    const rsp = q.vnp_ResponseCode; // "00" ok
    const payAmount = Number(q.vnp_Amount || "0")/100;

    const booking = await Booking.findOne({ code });
    if (!booking) return res.json({ RspCode: "01", Message: "Order not found" });

    // Kiểm tra số tiền (nên đúng depositAmount)
    if (payAmount !== Number(booking.depositAmount)) {
      return res.json({ RspCode: "02", Message: "Invalid amount" });
    }

    // Idempotent
    const ref = q.vnp_TransactionNo || q.vnp_TransactionStatus || Date.now().toString();
    if (booking.paymentRefs?.some(p => p.provider === "vnpay" && p.ref === ref)) {
      return res.json({ RspCode: "00", Message: "Already confirmed" });
    }

    if (rsp === "00") {
      booking.paymentRefs = booking.paymentRefs || [];
      booking.paymentRefs.push({ provider: "vnpay", ref, amount: payAmount, at: new Date() });
      await markDepositAndMaybeConfirm(booking, payAmount);
      return res.json({ RspCode: "00", Message: "Confirm success" });
    } else {
      return res.json({ RspCode: "00", Message: "Payment failed" });
    }
  } catch (err) {
    return res.json({ RspCode: "99", Message: "Unknown error" });
  }
};