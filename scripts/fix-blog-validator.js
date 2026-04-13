// scripts/fix-blog-validator.js
// Chạy: node scripts/fix-blog-validator.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function fixValidator() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // Xem validator hiện tại
  const collections = await db.listCollections({ name: "tbl_blog" }).toArray();
  if (collections.length === 0) {
    console.log("Collection tbl_blog not found!");
    process.exit(1);
  }

  const currentOptions = collections[0].options;
  console.log(
    "Current validator:",
    JSON.stringify(currentOptions?.validator, null, 2)
  );

  // Xóa validator (set về {})
  await db.command({
    collMod: "tbl_blog",
    validator: {},
    validationLevel: "off",
  });

  console.log("✅ Đã xóa validator của collection tbl_blog!");
  console.log("   Bây giờ có thể tạo bài viết bình thường.");

  await mongoose.disconnect();
  process.exit(0);
}

fixValidator().catch((err) => {
  console.error("❌ Lỗi:", err);
  process.exit(1);
});
