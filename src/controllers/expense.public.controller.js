import mongoose from "mongoose";
import { Expense } from "../models/Expense.js";

export const listExpensesPublic = async (req, res) => {
  const { id } = req.params; // tourId
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid tourId" });

  const items = await Expense.find({ tourId: id, visibleToCustomers: true })
    .sort({ occurredAt: 1, _id: 1 })
    .lean();

  const total = items.reduce((s, e) => s + (e.amount || 0), 0);
  res.json({ total, count: items.length, items });
};
