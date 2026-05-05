/**
 * Migration: Chuyển đổi bookingStatus từ enum cũ (p/c/x) sang enum mới
 * pending | confirmed | completed | cancelled
 *
 * Chạy: node scripts/migrate-booking-status.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/tlcn";

async function migrate() {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const col = mongoose.connection.collection("tbl_booking");

  const statusMap = {
    p: "pending",
    c: "confirmed",
    x: "cancelled",
    f: "completed",
  };

  let total = 0;
  for (const [oldVal, newVal] of Object.entries(statusMap)) {
    const result = await col.updateMany(
      { bookingStatus: oldVal },
      { $set: { bookingStatus: newVal } },
      { bypassDocumentValidation: true }
    );
    console.log(`  ${oldVal} → ${newVal}: ${result.modifiedCount} records`);
    total += result.modifiedCount;
  }

  // Set depositPaid=true cho các booking confirmed/completed có paidAmount đủ cọc
  const confirmedResult = await col.updateMany(
    {
      bookingStatus: { $in: ["confirmed", "completed"] },
      depositPaid: { $ne: true },
    },
    { $set: { depositPaid: true } },
    { bypassDocumentValidation: true }
  );
  console.log(`\n  depositPaid fix: ${confirmedResult.modifiedCount} records`);

  console.log(`\n✅ Migration done. Total updated: ${total} bookings`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
