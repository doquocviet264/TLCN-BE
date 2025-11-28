import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  fullName: { type: String },
  username: { type: String, required: true, unique: true, index: true },
  email:    { type: String, required: true, unique: true, index: true },
  password: { type: String },
  address:  { type: String },
  createdDate: { type: Date, default: Date.now }
}, { timestamps: false });

export const Admin = mongoose.model("Admin", adminSchema, "tbl_admin");
