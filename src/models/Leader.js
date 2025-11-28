import mongoose from "mongoose";

const LeaderSchema = new mongoose.Schema({
  fullName:    { type: String, required: true, trim: true },
  username:    { type: String, required: true, unique: true, index: true, trim: true },
  email:       { type: String, required: true, unique: true, index: true, trim: true },
  password:    { type: String, required: true },
  phoneNumber: { type: String, default: "" },
  address:     { type: String, default: "" },
  status:      { type: String, enum: ["active","inactive"], default: "active" }
}, { timestamps: true });

export const Leader = mongoose.model("Leader", LeaderSchema, "tbl_leader");
