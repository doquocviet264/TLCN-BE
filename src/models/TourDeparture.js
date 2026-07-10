// src/models/TourDeparture.js
import mongoose from "mongoose";

/* ------------------- Timeline Schema ------------------- */
const TimelineEventSchema = new mongoose.Schema({
  eventType: { type: String, enum: ["departed", "arrived", "checkpoint", "note", "finished"], required: true },
  at:        { type: Date, required: true },       // thời điểm xảy ra
  place:     { type: String, default: "" },         // địa điểm (tùy chọn)
  note:      { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  createdByRole: { type: String, enum: ["admin", "leader"], default: "admin" }
});

const PassengerCheckinSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  attendedPassengerIds: [{ type: String }],
  isPresent: { type: Boolean, default: false },
  checkedAt: { type: Date, default: Date.now },
  checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Leader" }
}, { _id: false });

const LeaderReportSchema = new mongoose.Schema({
  summary: { type: String, default: "" },
  incidents: { type: String, default: "" },
  expenseNote: { type: String, default: "" },
  noShowBookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
  status: { type: String, enum: ["submitted", "reviewed"], default: "submitted" },
  submittedAt: Date,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Leader" },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  reviewNote: { type: String, default: "" }
}, { _id: false });

/* ------------------- TourDeparture Schema ------------------- */
// Đại diện cho một lịch khởi hành thực tế, liên kết với Tour Template.
const tourDepartureSchema = new mongoose.Schema({
  tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true },

  // Thông tin ngày giờ
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },

  // Thông tin đặt chỗ
  min_guests:     { type: Number, default: 10 },
  max_guests:     { type: Number, default: 30 },
  current_guests: { type: Number, default: 0 },

  // Tuỳ chọn ghi đè giá của Tour Template cho lịch khởi hành này
  priceAdult: { type: Number },
  priceChild: { type: Number },

  // Quản lý trạng thái chuyến đi
  status: {
    type: String,
    enum: ["pending", "confirmed", "in_progress", "completed", "closed"],
    default: "pending"
  },

  // Phân công Leader
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: "Leader", default: null },

  // Timeline và các mốc thời gian thực tế
  timeline:   { type: [TimelineEventSchema], default: [] },
  departedAt: Date,
  arrivedAt:  Date,
  finishedAt: Date,

  // Danh sách điểm danh (khách có mặt/vắng mặt)
  passengerCheckins: { type: [PassengerCheckinSchema], default: [] },

  // Post-tour report submitted by the assigned leader.
  leaderReport: { type: LeaderReportSchema, default: null }
}, { timestamps: true });

/* ------------------- Indexes ------------------- */
tourDepartureSchema.index({ tourId: 1 });
tourDepartureSchema.index({ status: 1, startDate: 1, endDate: 1 });
tourDepartureSchema.index({ leaderId: 1 });
tourDepartureSchema.index({ startDate: 1, endDate: 1 });

/* ------------------- Export ------------------- */
export const TourDeparture = mongoose.model("TourDeparture", tourDepartureSchema, "tbl_tour_departures");
