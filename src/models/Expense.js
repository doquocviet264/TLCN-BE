// src/models/Expense.js
import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true },
  title:  { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  occurredAt: { type: Date, default: Date.now },
  note:   { type: String, default: "" },
  visibleToCustomers: { type: Boolean, default: true },

  addedBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true });

ExpenseSchema.index({ tourId: 1 });
ExpenseSchema.index({ occurredAt: -1 });

export const Expense = mongoose.model("Expense", ExpenseSchema, "tbl_expenses");
