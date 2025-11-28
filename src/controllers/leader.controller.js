import mongoose from "mongoose";
import { Tour } from "../models/Tour.js";
import { Expense } from "../models/Expense.js";

export const leaderMyTours = async (req,res)=>{
  const { status, onlyToday } = req.query;
  const filter = { leaderId: req.user.id };

  if (status) filter.status = status; // confirmed|in_progress|pending|completed|closed
  if (onlyToday === "1") {
    const now = new Date();
    filter.startDate = { $lte: now };
    filter.endDate   = { $gte: now };
  }

  const tours = await Tour.find(filter).sort({ startDate: 1 }).lean();
  res.json(tours);
};

export const leaderAddTimeline = async (req,res)=>{
  const { id } = req.params;               // tourId
  const { eventType, at, place, note } = req.body;

  const ALLOWED = ["departed","arrived","checkpoint","note","finished"];
  if (!ALLOWED.includes(eventType)) return res.status(400).json({ message:"Invalid eventType" });

  const atDate = at ? new Date(at) : new Date();
  if (isNaN(atDate.getTime())) return res.status(400).json({ message:"Invalid 'at' datetime" });

  const update = {
    $push: {
      timeline: {
        eventType,
        at: atDate,
        place: place || "",
        note:  note || "",
        createdBy: new mongoose.Types.ObjectId(req.user.id) // leader id
      }
    }
  };
  if (eventType === "departed") {
    update.$set = { ...(update.$set||{}), status: "in_progress", departedAt: atDate };
  }
  if (eventType === "arrived") {
    update.$set = { ...(update.$set||{}), arrivedAt: atDate };
  }
  if (eventType === "finished") {
    update.$set = { ...(update.$set||{}), status: "completed", finishedAt: atDate };
  }

  const tour = await Tour.findOneAndUpdate(
    { _id: id, leaderId: req.user.id }, // ràng buộc sở hữu
    update,
    { new: true }
  );
  if (!tour) return res.status(404).json({ message:"Tour not found or not assigned to you" });
  res.json({ message:"Timeline updated", tour });
};

export const leaderCreateExpense = async (req,res)=>{
  const { id } = req.params; // tourId
  const { title, amount, note, visibleToCustomers = true } = req.body;

  if (!title || !Number.isFinite(Number(amount))) {
    return res.status(400).json({ message:"title & amount are required" });
  }

  // chỉ cho phép leader thêm chi phí trên tour của mình
  const tour = await Tour.findOne({ _id: id, leaderId: req.user.id }).select("_id");
  if (!tour) return res.status(404).json({ message:"Tour not found or not assigned to you" });

  const expense = await Expense.create({
    tourId: tour._id,
    title,
    amount: Number(amount),
    occurredAt: new Date(),                     // thời gian server
    note: note || "",
    visibleToCustomers: Boolean(visibleToCustomers),
    addedBy: new mongoose.Types.ObjectId(req.user.id)
  });

  res.status(201).json({ message:"Expense created", expense });
};
