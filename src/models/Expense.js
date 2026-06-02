// src/models/Expense.js
import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  tourDepartureId: { type: mongoose.Schema.Types.ObjectId, ref: "TourDeparture", required: true },
  title:  { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  occurredAt: { type: Date, default: Date.now },
  note:   { type: String, default: "" },
  receiptImages: { type: [String], default: [] },
  visibleToCustomers: { type: Boolean, default: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  reviewedAt: Date,
  reviewNote: { type: String, default: "" },

  addedBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true });

ExpenseSchema.index({ tourDepartureId: 1 });
ExpenseSchema.index({ occurredAt: -1 });

export const Expense = mongoose.model("Expense", ExpenseSchema, "tbl_expenses");
