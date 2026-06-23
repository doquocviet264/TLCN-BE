import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { User } from "../src/models/User.js";
import { ProvinceProgress } from "../src/models/ProvinceProgress.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Hàm normalize giống FE (JourneyStats.tsx)
const normalizeProvince = (provinceName) =>
  (provinceName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const MERGED_PROVINCE_ALIASES = {
  "yen bai": "lao cai",
  "bac kan": "thai nguyen",
  "vinh phuc": "phu tho",
  "hoa binh": "phu tho",
  "bac giang": "bac ninh",
  "thai binh": "hung yen",
  "hai duong": "hai phong",
  "ha nam": "ninh binh",
  "nam dinh": "ninh binh",
  "quang binh": "quang tri",
  "quang nam": "da nang",
  "kon tum": "quang ngai",
  "binh dinh": "gia lai",
  "ninh thuan": "khanh hoa",
  "dak nong": "lam dong",
  "binh thuan": "lam dong",
  "phu yen": "dak lak",
  "ba ria vung tau": "ho chi minh",
  "binh duong": "ho chi minh",
  "tp ho chi minh": "ho chi minh",
  "thanh pho ho chi minh": "ho chi minh",
  "ho chi minh city": "ho chi minh",
  "binh phuoc": "dong nai",
  "long an": "tay ninh",
  "soc trang": "can tho",
  "hau giang": "can tho",
  "ben tre": "vinh long",
  "tra vinh": "vinh long",
  "tien giang": "dong thap",
  "bac lieu": "ca mau",
  "kien giang": "an giang",
  "ha giang": "tuyen quang",
  "thua thien hue": "hue",
  "a nang": "da nang",       // bug alias
  "ak lak": "dak lak",       // bug alias
  "ak nong": "lam dong",     // bug alias
  "ien bien": "dien bien",   // bug alias
  "ong nai": "dong nai",     // bug alias
  "ong thap": "dong thap",   // bug alias
  "lam ong": "lam dong",     // bug alias
};

const getMergedKey = (name) => {
  const norm = normalizeProvince(name);
  return MERGED_PROVINCE_ALIASES[norm] || norm;
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected\n");

  const user = await User.findOne({
    $or: [
      { email: /doquocviet624/i },
      { username: /doquocviet624/i },
    ],
  }).lean();

  if (!user) {
    console.log("❌ User không tìm thấy");
    return;
  }
  console.log(`User: ${user.email || user.username}\n`);

  const progress = await ProvinceProgress.find({ userId: user._id }).lean();
  console.log(`Tổng ProvinceProgress records: ${progress.length}\n`);

  const mergedKeys = new Set();
  const tourKeys = new Set();
  const manualKeys = new Set();

  console.log("Danh sách tỉnh trong DB → normalized → merged key:");
  progress.forEach((p) => {
    const normalized = normalizeProvince(p.provinceName);
    const mergedKey = getMergedKey(p.provinceName);
    mergedKeys.add(mergedKey);
    if (p.source === "tour" || p.source === "both") tourKeys.add(mergedKey);
    if (p.source === "manual" || p.source === "both") manualKeys.add(mergedKey);
    console.log(`  "${p.provinceName}" → "${normalized}" → "${mergedKey}" [${p.source}]`);
  });

  console.log(`\n📊 Sau khi merge:`);
  console.log(`  Unique merged keys (total): ${mergedKeys.size}`);
  console.log(`  Tour provinces: ${tourKeys.size}`);
  console.log(`  Manual provinces: ${manualKeys.size}`);

  const allKeys = new Set([...tourKeys, ...manualKeys]);
  console.log(`  Final count (min với 34): ${Math.min(allKeys.size, 34)}`);

  console.log(`\n🔑 Tất cả merged keys:`);
  [...allKeys].sort().forEach((k) => console.log(`  - ${k}`));
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());
