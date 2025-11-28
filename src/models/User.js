import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String },
  username: { type: String, required: true, unique: true, index: true },
  email:    { type: String, required: true, unique: true, index: true },
  password: { type: String },
  phoneNumber: { type: String },
  address:  { type: String },
  avatar:   { type: String },
  isActive: { type: String, enum: ["y","n"], default: "y" },
  status:   { type: String, enum: ["y","n"], default: "y" },
  google_id: { type: String },

  avatarUrl:      { type: String, default: "" },
  avatarPublicId: { type: String, default: "" },

  avatar:      { type: String, default: "" },  
  createdDate: { type: Date, default: Date.now }
}, { timestamps: false });

export const User = mongoose.model("User", userSchema, "tbl_users");
