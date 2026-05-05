import mongoose from "mongoose";
import dotenv from "dotenv";
import { Booking } from "../models/Booking.js";

dotenv.config();

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");

    const allBookingsRaw = await mongoose.connection.collection('tbl_booking').find({}).toArray();
    console.log(`Found ${allBookingsRaw.length} bookings total.`);

    for (const raw of allBookingsRaw) {
      const updates = {};
      
      // 1. Fix missing 'code' field
      if (!raw.code) {
        updates.code = raw.bookingId || ("BK" + Math.random().toString(36).slice(2, 8).toUpperCase());
      }

      // 2. Fix old status codes if present
      if (raw.bookingStatus === "p") updates.bookingStatus = "pending";
      else if (raw.bookingStatus === "c") updates.bookingStatus = "confirmed";
      else if (raw.bookingStatus === "x") updates.bookingStatus = "cancelled";

      // 3. Fix missing tourDepartureId if it was in tourId (but usually we need to map this carefully)
      // For now, let's just focus on the code and status which are critical for the UI.

      if (Object.keys(updates).length > 0) {
        await mongoose.connection.collection('tbl_booking').updateOne(
          { _id: raw._id },
          { $set: updates }
        );
        console.log(`Updated Booking ID: ${raw._id} -> Updates: ${JSON.stringify(updates)}`);
      }
    }

    console.log("Migration completed.");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
