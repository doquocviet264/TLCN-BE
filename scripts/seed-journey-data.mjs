import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { User } from "../src/models/User.js";
import { TravelMemory } from "../src/models/TravelMemory.js";
import { ProvinceProgress } from "../src/models/ProvinceProgress.js";
import { MemoryComment } from "../src/models/MemoryComment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SEED_PREFIX = "[Seed Journey]";
const TARGET_KEYWORD = "doquocviet624";

const TARGET_LOCATIONS = [
  { provinceName: "Hà Nội", source: "both", count: 3 },
  { provinceName: "Hải Phòng", source: "tour", count: 2 },
  { provinceName: "Huế", source: "manual", count: 1 },
  { provinceName: "Đà Nẵng", source: "both", count: 2 },
  { provinceName: "Hồ Chí Minh", source: "both", count: 3 },
  { provinceName: "Cần Thơ", source: "tour", count: 2 },
  { provinceName: "Cao Bằng", source: "manual", count: 1 },
  { provinceName: "Lạng Sơn", source: "manual", count: 1 },
  { provinceName: "Quảng Ninh", source: "tour", count: 2 },
  { provinceName: "Lai Châu", source: "manual", count: 1 },
  { provinceName: "Điện Biên", source: "manual", count: 1 },
  { provinceName: "Sơn La", source: "tour", count: 1 },
  { provinceName: "Lào Cai", source: "both", count: 2 },
  { provinceName: "Tuyên Quang", source: "manual", count: 1 },
  { provinceName: "Thái Nguyên", source: "tour", count: 1 },
  { provinceName: "Phú Thọ", source: "manual", count: 1 },
  { provinceName: "Bắc Ninh", source: "tour", count: 1 },
  { provinceName: "Hưng Yên", source: "manual", count: 1 },
  { provinceName: "Ninh Bình", source: "both", count: 2 },
  { provinceName: "Thanh Hóa", source: "tour", count: 1 },
  { provinceName: "Nghệ An", source: "manual", count: 1 },
  { provinceName: "Hà Tĩnh", source: "manual", count: 1 },
  { provinceName: "Quảng Trị", source: "tour", count: 2 },
  { provinceName: "Quảng Ngãi", source: "manual", count: 1 },
  { provinceName: "Gia Lai", source: "both", count: 2 },
  { provinceName: "Khánh Hòa", source: "tour", count: 2 },
  { provinceName: "Lâm Đồng", source: "both", count: 2 },
  { provinceName: "Đắk Lắk", source: "manual", count: 1 },
  { provinceName: "Đồng Nai", source: "tour", count: 1 },
  { provinceName: "Tây Ninh", source: "manual", count: 1 },
  { provinceName: "Vĩnh Long", source: "manual", count: 1 },
  { provinceName: "Đồng Tháp", source: "tour", count: 1 },
  { provinceName: "An Giang", source: "both", count: 2 },
  { provinceName: "Cà Mau", source: "manual", count: 1 },
];

// TARGET_ALIAS_LOCATIONS đã bị xóa sau khi cập nhật sang 34 tỉnh mới (2025).
// Các tên cũ (Quảng Nam, Bình Dương, Yên Bái, Hà Giang...) không còn được seed.
const TARGET_ALIAS_LOCATIONS = [];

const COMMUNITY_LOCATIONS = [
  { provinceName: "Hà Nội", source: "tour", count: 1 },
  { provinceName: "Đà Nẵng", source: "manual", count: 1 },
  { provinceName: "Huế", source: "manual", count: 1 },
  { provinceName: "Quảng Ninh", source: "tour", count: 1 },
  { provinceName: "Ninh Bình", source: "manual", count: 1 },
  { provinceName: "Lâm Đồng", source: "tour", count: 1 },
  { provinceName: "Khánh Hòa", source: "manual", count: 1 },
  { provinceName: "Cần Thơ", source: "tour", count: 1 },
  { provinceName: "An Giang", source: "manual", count: 1 },
  { provinceName: "Cà Mau", source: "manual", count: 1 },
  { provinceName: "Gia Lai", source: "tour", count: 1 },
  { provinceName: "Đắk Lắk", source: "manual", count: 1 },
];

const CAPTIONS = [
  "Một ngày đủ đẹp để lưu lại trên bản đồ cá nhân.",
  "Đi qua rồi mới thấy mỗi vùng đất có một nhịp rất riêng.",
  "Ảnh nhỏ, cảm giác lớn, thêm một dấu chân đáng nhớ.",
  "Ghi lại chuyến đi để lần sau nhìn bản đồ còn nhớ đường về.",
  "Một góc đường, một bữa ăn, một buổi chiều rất đáng giữ.",
];

const COMMENT_TEXTS = [
  "Nhìn ảnh là muốn xách balo đi ngay.",
  "Chỗ này đẹp thật, lưu lại để lần sau ghé.",
  "Bạn đi mùa này thời tiết có dễ chịu không?",
  "Ảnh có không khí rất du lịch luôn.",
  "Mình cũng từng đi qua đây, rất đáng nhớ.",
  "Có dịp chắc mình phải thử cung này.",
];

function slugify(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function imageSeed(value) {
  return slugify(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vietnam";
}

function imageUrls(provinceName, index) {
  const total = 2 + ((provinceName.length + index) % 2);
  const seed = imageSeed(provinceName);

  return Array.from(
    { length: total },
    (_, slot) => `https://picsum.photos/seed/journey-${seed}-${index}-${slot}/1200/800`
  );
}

function mergeSources(currentSource, nextSource) {
  const sourceSet = new Set();
  const add = (source) => {
    if (source === "both") {
      sourceSet.add("manual");
      sourceSet.add("tour");
      return;
    }
    if (source === "manual" || source === "tour") sourceSet.add(source);
  };

  add(currentSource);
  add(nextSource);

  if (sourceSet.has("manual") && sourceSet.has("tour")) return "both";
  if (sourceSet.has("tour")) return "tour";
  return "manual";
}

function sourceForMemory(progressSource, memoryIndex) {
  if (progressSource !== "both") return progressSource;
  return memoryIndex % 2 === 0 ? "tour" : "manual";
}

// Trai deu trong ~2 nam gan day, luon nho hon "hom nay" - khong de globalIndex
// (vd userIndex * 100) lam ngay bi day xa ve tuong lai nhu truoc.
const VISITED_DATE_RANGE_DAYS = 720;

function visitedDate(globalIndex) {
  const dayOffset = ((globalIndex * 13) % VISITED_DATE_RANGE_DAYS) + 1; // 1..720, luon > 0
  const date = new Date();
  date.setUTCHours(9, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - dayOffset);
  return date;
}

function buildCommunityPlan(userIndex) {
  const amount = 4 + (userIndex % 3);
  const start = (userIndex * 3) % COMMUNITY_LOCATIONS.length;
  return Array.from({ length: amount }, (_, index) => {
    const location = COMMUNITY_LOCATIONS[(start + index) % COMMUNITY_LOCATIONS.length];
    return { ...location };
  });
}

async function seedCommentsForMemory(memory, users, globalIndex) {
  if (memory.privacy !== "public") return 0;

  const commenters = users.filter(
    (item) => item._id.toString() !== memory.userId.toString()
  );

  if (!commenters.length) return 0;

  const count = 1 + (globalIndex % 3);
  const comments = Array.from({ length: count }, (_, index) => {
    const commenter = commenters[(globalIndex + index) % commenters.length];

    return {
      memoryId: memory._id,
      userId: commenter._id,
      content: COMMENT_TEXTS[(globalIndex + index) % COMMENT_TEXTS.length],
      createdAt: new Date(memory.visitedAt.getTime() + (index + 1) * 3600000),
      updatedAt: new Date(memory.visitedAt.getTime() + (index + 1) * 3600000),
    };
  });

  await MemoryComment.insertMany(comments);
  memory.commentsCount = comments.length;
  await memory.save();

  return comments.length;
}

async function ensureProgress(userId, location, firstMemory) {
  const normalizedProvinceName = slugify(location.provinceName);
  const existingProgress = await ProvinceProgress.findOne({
    userId,
    normalizedProvinceName,
  });

  if (!existingProgress) {
    await ProvinceProgress.create({
      userId,
      provinceName: location.provinceName,
      normalizedProvinceName,
      unlockedAt: firstMemory.visitedAt,
      source: location.source,
      firstMemoryId: firstMemory._id,
    });
    return "created";
  }

  existingProgress.source = mergeSources(existingProgress.source, location.source);

  const firstMemoryStillExists =
    existingProgress.firstMemoryId &&
    (await TravelMemory.exists({ _id: existingProgress.firstMemoryId }));

  if (!firstMemoryStillExists) {
    existingProgress.firstMemoryId = firstMemory._id;
  }

  await existingProgress.save();
  return "updated";
}

async function seedUser(user, locations, userIndex, users) {
  let createdMemories = 0;
  let createdComments = 0;
  let createdProgress = 0;
  let updatedProgress = 0;
  let globalIndex = userIndex * 100;

  for (const location of locations) {
    const memories = [];
    const count = Math.max(location.count || 1, location.source === "both" ? 2 : 1);

    for (let index = 0; index < count; index += 1) {
      const memorySource = sourceForMemory(location.source, index);
      const publicMemory = (globalIndex + index) % 4 !== 0;
      const caption = `${SEED_PREFIX} ${location.provinceName}: ${
        CAPTIONS[(globalIndex + index) % CAPTIONS.length]
      }`;

      const memory = await TravelMemory.create({
        userId: user._id,
        provinceName: location.provinceName,
        visitedAt: visitedDate(globalIndex + index),
        caption,
        images: imageUrls(location.provinceName, globalIndex + index),
        privacy: publicMemory ? "public" : "private",
        source: memorySource,
        isVerifiedByTour: memorySource === "tour",
        likesCount: publicMemory ? (globalIndex + index) % 17 : 0,
        commentsCount: 0,
      });

      createdComments += await seedCommentsForMemory(
        memory,
        users,
        globalIndex + index
      );

      memories.push(memory);
      createdMemories += 1;
    }

    const progressAction = await ensureProgress(user._id, location, memories[0]);
    if (progressAction === "created") createdProgress += 1;
    if (progressAction === "updated") updatedProgress += 1;

    globalIndex += count;
  }

  return { createdMemories, createdComments, createdProgress, updatedProgress };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in TLCN-BE/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find({
    $or: [{ isActive: { $exists: false } }, { isActive: { $ne: "n" } }],
  })
    .select("_id fullName username email")
    .sort({ createdAt: 1 })
    .lean();

  if (!users.length) {
    console.log("No users found. Journey seed skipped.");
    return;
  }

  const targetUser = users.find((user) => {
    const email = user.email || "";
    const username = user.username || "";
    return (
      email.toLowerCase().includes(TARGET_KEYWORD) ||
      username.toLowerCase().includes(TARGET_KEYWORD)
    );
  });

  const userIds = users.map((user) => user._id);
  const oldSeedMemoryIds = await TravelMemory.find({
    userId: { $in: userIds },
    caption: { $regex: "^\\[Seed Journey\\]" },
  }).distinct("_id");

  const deletedComments = oldSeedMemoryIds.length
    ? await MemoryComment.deleteMany({ memoryId: { $in: oldSeedMemoryIds } })
    : { deletedCount: 0 };

  const deleted = await TravelMemory.deleteMany({
    userId: { $in: userIds },
    caption: { $regex: "^\\[Seed Journey\\]" },
  });

  let totalMemories = 0;
  let totalComments = 0;
  let totalCreatedProgress = 0;
  let totalUpdatedProgress = 0;

  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const isTarget = targetUser?._id.toString() === user._id.toString();
    const locations = isTarget
      ? [...TARGET_LOCATIONS, ...TARGET_ALIAS_LOCATIONS]
      : buildCommunityPlan(index);

    const result = await seedUser(user, locations, index, users);
    totalMemories += result.createdMemories;
    totalComments += result.createdComments;
    totalCreatedProgress += result.createdProgress;
    totalUpdatedProgress += result.updatedProgress;

    console.log(
      `Seeded ${result.createdMemories} memories for ${user.email || user.username}${
        isTarget ? " (target)" : ""
      }`
    );
  }

  console.log("");
  console.log(`Deleted previous seed comments: ${deletedComments.deletedCount || 0}`);
  console.log(`Deleted previous seed memories: ${deleted.deletedCount || 0}`);
  console.log(`Created seed memories: ${totalMemories}`);
  console.log(`Created seed comments: ${totalComments}`);
  console.log(`Created province progress rows: ${totalCreatedProgress}`);
  console.log(`Updated province progress rows: ${totalUpdatedProgress}`);

  if (targetUser) {
    console.log(
      `Target user enriched: ${targetUser.email || targetUser.username} (${TARGET_LOCATIONS.length} current provinces + ${TARGET_ALIAS_LOCATIONS.length} alias provinces)`
    );
  } else {
    console.log(`Target user not found with keyword: ${TARGET_KEYWORD}`);
  }
}

main()
  .catch((error) => {
    console.error("Journey seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
