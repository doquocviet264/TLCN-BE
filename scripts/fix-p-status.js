import mongoose from "mongoose";
import dotenv from "dotenv";
import { Booking } from "../src/models/Booking.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to DB");

    const result = await Booking.updateMany(
      { bookingStatus: "p" },
      { $set: { bookingStatus: "pending" } }
    );

    console.log(`Updated ${result.modifiedCount} bookings from 'p' to 'pending'.`);

    // Check for other short codes just in case
    const shortCodes = {
      "c": "confirmed",
      "f": "completed",
      "x": "cancelled"
    };

    for (const [short, long] of Object.entries(shortCodes)) {
      const res = await Booking.updateMany(
        { bookingStatus: short },
        { $set: { bookingStatus: long } }
      );
      if (res.modifiedCount > 0) {
        console.log(`Updated ${res.modifiedCount} bookings from '${short}' to '${long}'.`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
