// src/models/TourDeparture.js
import mongoose from "mongoose";

/* ------------------- Timeline Schema ------------------- */
const TimelineEventSchema = new mongoose.Schema({
  eventType: { type: String, enum: ["departed", "arrived", "checkpoint", "note", "finished"], required: true },
  at:        { type: Date, required: true },       // thời điểm xảy ra
  place:     { type: String, default: "" },         // địa điểm (tùy chọn)
  note:      { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }
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
  finishedAt: Date
}, { timestamps: true });

/* ------------------- Indexes ------------------- */
tourDepartureSchema.index({ tourId: 1 });
tourDepartureSchema.index({ status: 1, startDate: 1, endDate: 1 });
tourDepartureSchema.index({ leaderId: 1 });
tourDepartureSchema.index({ startDate: 1, endDate: 1 });

/* ------------------- Export ------------------- */
export const TourDeparture = mongoose.model("TourDeparture", tourDepartureSchema, "tbl_tour_departures");
