import mongoose from "mongoose";
import dotenv from "dotenv";
import { Booking } from "../src/models/Booking.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to DB");

    const userId = "69b41a985a4faeb9846803f4";
    const bookings = await Booking.find({});
    
    const statuses = bookings.map(b => b.bookingStatus);
    const uniqueStatuses = [...new Set(statuses)];
    console.log("Unique statuses found in DB:", uniqueStatuses);

    const invalid = bookings.filter(b => !["pending", "confirmed", "completed", "cancelled"].includes(b.bookingStatus));
    if (invalid.length > 0) {
      console.log(`Found ${invalid.length} bookings with invalid status:`);
      invalid.forEach(b => console.log(`Code: ${b.code}, Status: ${b.bookingStatus}`));
    } else {
      console.log("All statuses are valid according to the enum.");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
