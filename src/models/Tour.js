import mongoose from "mongoose";

function slugify(str = "") {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/* ------------------- Itinerary Schema ------------------- */
const segmentSchema = new mongoose.Schema({
  timeOfDay: { type: String, enum: ["morning", "afternoon", "evening"], required: true },
  title:     { type: String, required: true },
  items:     { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { _id: false });

const daySchema = new mongoose.Schema({
  day:     { type: Number, required: true, min: 1 },
  title:   { type: String, required: true },
  summary: { type: String, default: "" },
  segments:{ type: [segmentSchema], default: [] },
  photos:  { type: [String], default: [] }
}, { _id: false });

/* ------------------- Tour Schema (Template) ------------------- */
// Chỉ lưu thông tin tĩnh, mang tính mô tả sản phẩm.
// Các thông tin thuộc về lịch khởi hành cụ thể đã được chuyển sang TourDeparture.
const tourSchema = new mongoose.Schema({
  title:           { type: String, required: true },
  time:            { type: String },
  description:     { type: String },
  destination:     { type: String },
  destinationSlug: { type: String, index: true },
  status: { 
    type: String, 
    enum: ["active", "hidden", "paused", "deleted"], 
    default: "active" 
  },

  // Giá cơ sở (có thể bị ghi đè bởi TourDeparture)
  priceAdult:  { type: Number },
  priceChild:  { type: Number },
  
  // Số lượng khách tối đa cơ sở
  quantity:    { type: Number, default: 30 },

  images:    { type: [String], default: [] },
  itinerary: { type: [daySchema], default: [] },
  includes:  { type: [String], default: [] },
  excludes:  { type: [String], default: [] }
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
tourSchema.index({ priceAdult: 1, priceChild: 1 });
tourSchema.index({ title: "text", description: "text", destination: "text" });

/* ------------------- Export ------------------- */
export const Tour = mongoose.model("Tour", tourSchema, "tbl_tours");
