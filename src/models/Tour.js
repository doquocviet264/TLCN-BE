import mongoose from "mongoose";

function slugify(str = "") {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/* ------------------- Leader Schema ------------------- */
const LeaderSchema = new mongoose.Schema({
  fullName:    { type: String, required: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },
  note:        { type: String, default: "" }
}, { _id: false });

/* ------------------- Timeline Schema ------------------- */
const TimelineEventSchema = new mongoose.Schema({
  eventType: { type: String, enum: ["departed", "arrived", "checkpoint", "note", "finished"], required: true },
  at:        { type: Date, required: true },            // thời điểm xảy ra
  place:     { type: String, default: "" },             // địa điểm (tùy chọn)
  note:      { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }
}, { _id: false });

/* ------------------- Itinerary Schema ------------------- */
const segmentSchema = new mongoose.Schema({
  timeOfDay: { type: String, enum: ["morning", "afternoon", "evening"], required: true },
  title:     { type: String, required: true },
  items:     { type: [String], default: [] }
}, { _id: false });

const daySchema = new mongoose.Schema({
  day:     { type: Number, required: true, min: 1 },
  title:   { type: String, required: true },
  summary: { type: String, default: "" },
  segments:{ type: [segmentSchema], default: [] },
  photos:  { type: [String], default: [] }
}, { _id: false });

/* ------------------- Tour Schema ------------------- */
const tourSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  time:         { type: String },
  description:  { type: String },
  quantity:     { type: Number },
  priceAdult:   { type: Number },
  priceChild:   { type: Number },
  destination:  { type: String },
  destinationSlug: { type: String, index: true },
  startDate:    { type: Date },
  endDate:      { type: Date },
  min_guests:     { type: Number, default: 10 },
  current_guests: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ["pending", "confirmed", "in_progress", "completed", "closed"], 
    default: "pending" 
  },
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: "Leader", default: null },
  leader:     { type: LeaderSchema, default: null },
  timeline:   { type: [TimelineEventSchema], default: [] },
  departedAt: Date,
  arrivedAt:  Date,
  finishedAt: Date,

  images:     { type: [String], default: [] },
  itinerary:  { type: [daySchema], default: [] }
}, { timestamps: true });

/* ------------------- Hooks ------------------- */
// Tự tạo slug khi save
tourSchema.pre("save", function(next) {
  if (this.isModified("destination") || !this.destinationSlug) {
    this.destinationSlug = slugify(this.destination || "");
  }
  next();
});

// Tự tạo slug khi update qua findOneAndUpdate
tourSchema.pre("findOneAndUpdate", function(next) {
  const update = this.getUpdate() || {};
  if (update.destination) {
    update.destinationSlug = slugify(update.destination);
    this.setUpdate(update);
  }
  next();
});

/* ------------------- Indexes ------------------- */
tourSchema.index({ status: 1, startDate: 1, endDate: 1 });
tourSchema.index({ "leader.phoneNumber": 1 });
tourSchema.index({ startDate: 1, endDate: 1 });
tourSchema.index({ priceAdult: 1, priceChild: 1 });
tourSchema.index({ title: "text", description: "text", destination: "text" });

/* ------------------- Export ------------------- */
export const Tour = mongoose.model("Tour", tourSchema, "tbl_tours");
