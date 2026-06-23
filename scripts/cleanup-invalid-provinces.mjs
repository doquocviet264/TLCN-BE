import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { ProvinceProgress } from "../src/models/ProvinceProgress.js";
import { TravelMemory } from "../src/models/TravelMemory.js";
import { MemoryComment } from "../src/models/MemoryComment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ============================================================
// Hàm slugify (giống với ProvinceProgress model)
// ============================================================
function slugify(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// CHỈ 34 tỉnh/thành HỢP LỆ sau sáp nhập (2025)
// KHÔNG bao gồm tên cũ / alias
// ============================================================
const VALID_34_PROVINCES = [
  "Hà Nội",
  "Tuyên Quang",   // sáp nhập: Hà Giang + Tuyên Quang
  "Lào Cai",       // sáp nhập: Yên Bái + Lào Cai
  "Thái Nguyên",   // sáp nhập: Bắc Kạn + Thái Nguyên
  "Phú Thọ",       // sáp nhập: Vĩnh Phúc + Hòa Bình + Phú Thọ
  "Bắc Ninh",      // sáp nhập: Bắc Giang + Bắc Ninh
  "Hưng Yên",      // sáp nhập: Thái Bình + Hưng Yên
  "Hải Phòng",     // sáp nhập: Hải Dương + Hải Phòng
  "Ninh Bình",     // sáp nhập: Hà Nam + Nam Định + Ninh Bình
  "Quảng Trị",     // sáp nhập: Quảng Bình + Quảng Trị
  "Đà Nẵng",       // sáp nhập: Quảng Nam + Đà Nẵng
  "Quảng Ngãi",    // sáp nhập: Kon Tum + Quảng Ngãi
  "Gia Lai",       // sáp nhập: Bình Định + Gia Lai
  "Khánh Hòa",     // sáp nhập: Ninh Thuận + Khánh Hòa
  "Lâm Đồng",      // sáp nhập: Đắk Nông + Bình Thuận + Lâm Đồng
  "Đắk Lắk",       // sáp nhập: Phú Yên + Đắk Lắk
  "Hồ Chí Minh",   // TP.HCM mở rộng: TP.HCM + Bình Dương + Bà Rịa–Vũng Tàu
  "Đồng Nai",      // sáp nhập: Đồng Nai + Bình Phước
  "Tây Ninh",      // sáp nhập: Tây Ninh + Long An
  "Cần Thơ",       // sáp nhập: Cần Thơ + Sóc Trăng + Hậu Giang
  "Vĩnh Long",     // sáp nhập: Bến Tre + Vĩnh Long + Trà Vinh
  "Đồng Tháp",     // sáp nhập: Tiền Giang + Đồng Tháp
  "Cà Mau",        // sáp nhập: Bạc Liêu + Cà Mau
  "An Giang",      // sáp nhập: Kiên Giang + An Giang
  "Huế",
  "Lai Châu",
  "Điện Biên",
  "Sơn La",
  "Lạng Sơn",
  "Quảng Ninh",
  "Thanh Hóa",
  "Nghệ An",
  "Hà Tĩnh",
  "Cao Bằng",
];

// Tập hợp các normalized name hợp lệ (CHỈ 34 tỉnh mới)
const VALID_NORMALIZED = new Set(VALID_34_PROVINCES.map(slugify));

// ============================================================
// Main
// ============================================================
async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in TLCN-BE/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
  console.log(`📋 Danh sách ${VALID_34_PROVINCES.length} tỉnh hợp lệ:\n`);
  VALID_34_PROVINCES.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  console.log();

  // ----------------------------------------------------------
  // 1. Tìm các ProvinceProgress không hợp lệ (kể cả tên cũ/alias)
  // ----------------------------------------------------------
  const allProgress = await ProvinceProgress.find(
    {},
    { _id: 1, provinceName: 1, normalizedProvinceName: 1, userId: 1 }
  ).lean();

  const invalidProgress = allProgress.filter((p) => {
    const normalized = p.normalizedProvinceName || slugify(p.provinceName);
    return !VALID_NORMALIZED.has(normalized);
  });

  if (invalidProgress.length === 0) {
    console.log("✅ Không có ProvinceProgress nào ngoài danh sách 34 tỉnh mới.\n");
  } else {
    console.log(`⚠️  Tìm thấy ${invalidProgress.length} ProvinceProgress cần xóa (tên cũ/alias/không hợp lệ):`);
    const grouped = {};
    for (const p of invalidProgress) {
      grouped[p.provinceName] = (grouped[p.provinceName] || 0) + 1;
    }
    for (const [name, count] of Object.entries(grouped)) {
      console.log(`   - "${name}": ${count} record(s)`);
    }
    console.log();
  }

  // ----------------------------------------------------------
  // 2. Tìm các TravelMemory không hợp lệ (kể cả tên cũ/alias)
  // ----------------------------------------------------------
  const allMemories = await TravelMemory.find(
    {},
    { _id: 1, provinceName: 1, userId: 1 }
  ).lean();

  const invalidMemories = allMemories.filter((m) => {
    const normalized = slugify(m.provinceName || "");
    return !VALID_NORMALIZED.has(normalized);
  });

  if (invalidMemories.length === 0) {
    console.log("✅ Không có TravelMemory nào ngoài danh sách 34 tỉnh mới.\n");
  } else {
    console.log(`⚠️  Tìm thấy ${invalidMemories.length} TravelMemory cần xóa (tên cũ/alias/không hợp lệ):`);
    const grouped = {};
    for (const m of invalidMemories) {
      grouped[m.provinceName] = (grouped[m.provinceName] || 0) + 1;
    }
    for (const [name, count] of Object.entries(grouped)) {
      console.log(`   - "${name}": ${count} record(s)`);
    }
    console.log();
  }

  // ----------------------------------------------------------
  // 3. Nếu không có gì cần xóa → dừng
  // ----------------------------------------------------------
  if (invalidProgress.length === 0 && invalidMemories.length === 0) {
    console.log("🎉 Database đã sạch. Không có gì cần xóa.");
    return;
  }

  // ----------------------------------------------------------
  // 4. Xóa TravelMemory không hợp lệ + các comment liên quan
  // ----------------------------------------------------------
  let deletedMemoryCount = 0;
  let deletedCommentCount = 0;

  if (invalidMemories.length > 0) {
    const invalidMemoryIds = invalidMemories.map((m) => m._id);

    const commentResult = await MemoryComment.deleteMany({
      memoryId: { $in: invalidMemoryIds },
    });
    deletedCommentCount = commentResult.deletedCount;

    const memoryResult = await TravelMemory.deleteMany({
      _id: { $in: invalidMemoryIds },
    });
    deletedMemoryCount = memoryResult.deletedCount;

    console.log(`🗑️  Đã xóa ${deletedMemoryCount} TravelMemory (tên tỉnh cũ/alias)`);
    console.log(`🗑️  Đã xóa ${deletedCommentCount} MemoryComment liên quan`);
  }

  // ----------------------------------------------------------
  // 5. Xóa ProvinceProgress không hợp lệ
  // ----------------------------------------------------------
  let deletedProgressCount = 0;

  if (invalidProgress.length > 0) {
    const invalidProgressIds = invalidProgress.map((p) => p._id);

    const progressResult = await ProvinceProgress.deleteMany({
      _id: { $in: invalidProgressIds },
    });
    deletedProgressCount = progressResult.deletedCount;

    console.log(`🗑️  Đã xóa ${deletedProgressCount} ProvinceProgress (tên tỉnh cũ/alias)`);
  }

  // ----------------------------------------------------------
  // 6. Kiểm tra lại số tỉnh còn lại
  // ----------------------------------------------------------
  const remainingProgress = await ProvinceProgress.distinct("provinceName");
  console.log(`\n✅ Số tỉnh còn lại trong ProvinceProgress: ${remainingProgress.length}`);

  // ----------------------------------------------------------
  // 7. Tổng kết
  // ----------------------------------------------------------
  console.log("\n========================================");
  console.log("📊 KẾT QUẢ XÓA:");
  console.log(`   TravelMemory đã xóa    : ${deletedMemoryCount}`);
  console.log(`   MemoryComment đã xóa   : ${deletedCommentCount}`);
  console.log(`   ProvinceProgress đã xóa: ${deletedProgressCount}`);
  console.log("========================================");
}

main()
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  });
