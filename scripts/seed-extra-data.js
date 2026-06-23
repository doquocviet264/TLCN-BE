/**
 * Seed thêm dữ liệu (tours, users, bookings, reviews, interactions) theo đúng
 * format của dữ liệu hiện có, nhằm tăng mật độ dữ liệu cho hệ thống gợi ý.
 *
 * Quy mô "Vừa": +15 tours, +40 users, ~600 bookings, ~400 reviews, ~2000 interactions.
 * Chiến lược: phân bố hành vi (booking/review/interaction) NGẪU NHIÊN ĐỀU trên
 * toàn bộ user/tour — không gán cụm sở thích.
 *
 * Chạy: node scripts/seed-extra-data.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import { Tour } from "../src/models/Tour.js";
import { TourDeparture } from "../src/models/TourDeparture.js";
import { User } from "../src/models/User.js";
import { Booking } from "../src/models/Booking.js";
import { Review } from "../src/models/Review.js";

dotenv.config();

// ── Config quy mô ────────────────────────────────────────────────────────────
const N_USERS = 40;
const N_BOOKINGS = 600;
const N_REVIEWS = 400;
const N_INTERACTIONS = 2000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(str = "") {
  return str
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(weightedMap) {
  const entries = Object.entries(weightedMap);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateBetween(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function genCode(existing) {
  let code;
  do {
    code = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (existing.has(code));
  existing.add(code);
  return code;
}

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

// ── Data pools ────────────────────────────────────────────────────────────────
const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
  "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800",
  "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
  "https://images.unsplash.com/photo-1578986175247-7d60c6e2c2b0?w=800",
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800",
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
];

const INCLUDES = [
  "Xe đưa đón theo chương trình",
  "Khách sạn tiêu chuẩn (phòng đôi/twin)",
  "Các bữa ăn theo chương trình",
  "Hướng dẫn viên nhiệt tình, kinh nghiệm",
  "Vé tham quan các điểm trong chương trình",
  "Bảo hiểm du lịch",
];

const EXCLUDES = [
  "Chi phí cá nhân ngoài chương trình",
  "Tiền tip cho hướng dẫn viên và tài xế",
  "Đồ uống trong bữa ăn",
  "Phụ thu phòng đơn (nếu có)",
];

// 15 tour mới: [destination, title, days, priceAdult, priceChild]
const NEW_TOURS = [
  ["Đà Nẵng", "Đà Nẵng - Bà Nà Hills & Hội An", 3, 4200000, 3000000],
  ["Hà Giang", "Hà Giang - Cao Nguyên Đá Đồng Văn", 4, 3800000, 2800000],
  ["Ninh Bình", "Ninh Bình - Tam Cốc Bích Động", 2, 2200000, 1600000],
  ["Khánh Hòa", "Nha Trang - Biển Xanh Cát Trắng", 3, 4500000, 3200000],
  ["Côn Đảo", "Côn Đảo - Hoang Sơ Biển Đảo", 3, 6800000, 4800000],
  ["Lào Cai", "Sa Pa - Mây Mù Núi Rừng", 3, 3500000, 2500000],
  ["Quảng Bình", "Phong Nha - Kẻ Bàng Kỳ Vĩ", 3, 4000000, 2900000],
  ["Lâm Đồng", "Đà Lạt - Thành Phố Mộng Mơ", 3, 3200000, 2300000],
  ["Phú Yên", "Phú Yên - Hoa Vàng Cỏ Xanh", 3, 4300000, 3000000],
  ["Huế", "Huế - Cố Đô Di Sản", 2, 2800000, 2000000],
  ["Tây Nguyên", "Đắk Lắk - Đại Ngàn Tây Nguyên", 4, 4600000, 3300000],
  ["Bình Thuận", "Mũi Né - Đồi Cát Bay", 2, 2600000, 1900000],
  ["Cần Thơ", "Miền Tây - Sông Nước Cần Thơ", 2, 2400000, 1700000],
  ["Quảng Nam", "Hội An - Phố Cổ Đèn Lồng", 2, 2900000, 2100000],
  ["Kiên Giang", "Phú Quốc - Nghỉ Dưỡng Resort 5 Sao", 5, 8500000, 6000000],
];

const FAMILY_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const MIDDLE_NAMES = ["Văn", "Thị", "Hữu", "Đức", "Minh", "Ngọc", "Thanh", "Hoàng", "Anh", "Quang", "Gia", "Bảo"];
const GIVEN_NAMES = ["Tuấn", "Hùng", "Dũng", "Hải", "Long", "Nam", "Phong", "Khánh", "Bảo", "Huy", "Quân", "Đạt", "Sơn", "Thắng", "Vinh", "Linh", "Trang", "Hương", "Lan", "Hoa", "Mai", "Thảo", "Trinh", "Ngân", "Chi", "Yến", "Hà", "Vy", "My", "Quỳnh"];
const CITIES = ["Hà Nội", "TP.HCM", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Huế", "Nha Trang", "Vũng Tàu", "Biên Hòa", "Quy Nhơn", "Buôn Ma Thuột", "Đà Lạt"];

const REVIEW_COMMENTS = {
  5: ["Chuyến đi tuyệt vời, sẽ quay lại lần sau!", "Dịch vụ rất tốt, hướng dẫn viên nhiệt tình.", "Cảnh đẹp, đồ ăn ngon, rất hài lòng.", "Tour đáng giá từng đồng, recommend mọi người.", "Trải nghiệm tuyệt vời cùng gia đình."],
  4: ["Tour ổn, chỉ có lịch trình hơi gấp.", "Khá hài lòng, sẽ giới thiệu cho bạn bè.", "Hướng dẫn viên tốt, khách sạn ổn.", "Chuyến đi vui vẻ, đáng để trải nghiệm."],
  3: ["Tour tạm được, một số điểm cần cải thiện.", "Bình thường, không có gì đặc sắc lắm.", "Ổn so với giá, nhưng có thể tốt hơn."],
  2: ["Khá thất vọng về chất lượng khách sạn.", "Lịch trình quá gấp, không kịp nghỉ ngơi."],
  1: ["Không như mong đợi, dịch vụ kém.", "Sẽ không quay lại lần sau."],
};

const INTERACTION_TYPE_WEIGHTS = { view: 75, click: 15, bookmark: 7, share: 3 };
const SOURCE_WEIGHTS = { homepage: 65, similar: 22, search: 6, direct: 7 };
const DEVICE_WEIGHTS = { desktop: 50, mobile: 45, tablet: 5 };
const BOOKING_STATUS_WEIGHTS = { pending: 39, confirmed: 31, completed: 19, cancelled: 11 };

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to DB");

  const db = mongoose.connection.db;
  const now = new Date();

  // ───────────────────────── 1) TOURS ─────────────────────────
  console.log("\n--- Tạo tours mới ---");
  const tourDocs = NEW_TOURS.map(([destination, title, days, priceAdult, priceChild]) => {
    const images = [...IMAGE_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
    const itinerary = Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      title: i === 0
        ? `Khởi hành - ${destination}`
        : i === days - 1
          ? `${destination} - Kết thúc hành trình`
          : `Khám phá ${destination} - Ngày ${i + 1}`,
      summary: `Hoạt động tham quan, khám phá và trải nghiệm văn hóa, ẩm thực tại ${destination}.`,
      segments: [
        { timeOfDay: "morning", title: "Buổi sáng", items: ["Ăn sáng tại khách sạn", `Tham quan các điểm nổi bật tại ${destination}`] },
        { timeOfDay: "afternoon", title: "Buổi chiều", items: ["Dùng bữa trưa", "Tự do tham quan, mua sắm đặc sản"] },
        { timeOfDay: "evening", title: "Buổi tối", items: ["Dùng bữa tối", "Nghỉ ngơi tại khách sạn"] },
      ],
      photos: [pick(IMAGE_POOL)],
    }));

    return {
      title: `${title} ${days}N${days - 1}Đ`,
      time: `${days} ngày ${days - 1} đêm`,
      description: `Khám phá ${destination} với hành trình ${days} ngày ${days - 1} đêm, trải nghiệm cảnh đẹp, văn hóa và ẩm thực địa phương đặc sắc.`,
      destination,
      destinationSlug: slugify(destination),
      status: "active",
      priceAdult,
      priceChild,
      quantity: randInt(20, 40),
      images,
      itinerary,
      includes: INCLUDES,
      excludes: EXCLUDES,
    };
  });

  const insertedTours = await Tour.insertMany(tourDocs);
  console.log(`✅ Đã tạo ${insertedTours.length} tours mới`);

  // ───────────────────────── 2) TOUR DEPARTURES (cho tour mới) ─────────────────────────
  console.log("\n--- Tạo departures cho tours mới ---");
  const departureDocs = [];
  for (const tour of insertedTours) {
    const days = NEW_TOURS.find(([d, t]) => slugify(d) === tour.destinationSlug)?.[2] || 3;
    for (let i = 0; i < 2; i++) {
      const startDate = randomDateBetween(
        new Date(now.getTime() + 20 * 86400000),
        new Date(now.getTime() + 150 * 86400000)
      );
      const endDate = new Date(startDate.getTime() + (days - 1) * 86400000);
      departureDocs.push({
        tourId: tour._id,
        startDate,
        endDate,
        min_guests: randInt(8, 15),
        max_guests: randInt(25, 40),
        current_guests: randInt(0, 10),
        priceAdult: tour.priceAdult,
        priceChild: tour.priceChild,
        status: "pending",
      });
    }
  }
  const insertedDepartures = await TourDeparture.insertMany(departureDocs);
  console.log(`✅ Đã tạo ${insertedDepartures.length} departures mới`);

  // ───────────────────────── 3) USERS ─────────────────────────
  console.log("\n--- Tạo users mới ---");
  const existingUsers = await User.find({}, { username: 1, email: 1 }).lean();
  const usedUsernames = new Set(existingUsers.map((u) => u.username));
  const usedEmails = new Set(existingUsers.map((u) => u.email));

  const userDocs = [];
  for (let i = 0; i < N_USERS; i++) {
    const family = pick(FAMILY_NAMES);
    const middle = pick(MIDDLE_NAMES);
    const given = pick(GIVEN_NAMES);
    const fullName = `${family} ${middle} ${given}`;

    let username, email;
    do {
      const base = removeDiacritics(`${given}${family}`).toLowerCase().replace(/\s+/g, "");
      username = `${base}${randInt(100, 9999)}`;
    } while (usedUsernames.has(username));
    usedUsernames.add(username);

    do {
      const base = removeDiacritics(`${given}.${family}`).toLowerCase().replace(/\s+/g, "");
      email = `${base}${randInt(100, 9999)}@gmail.com`;
    } while (usedEmails.has(email));
    usedEmails.add(email);

    const hashedPassword = await bcrypt.hash("Travela@123", 10);
    const createdDate = randomDateBetween(new Date(now.getTime() - 200 * 86400000), now);

    userDocs.push({
      fullName,
      username,
      email,
      password: hashedPassword,
      phoneNumber: "0" + randInt(300000000, 999999999),
      address: pick(CITIES),
      gender: pick(["Male", "Female"]),
      dob: randomDateBetween(new Date(1975, 0, 1), new Date(2005, 11, 31)),
      city: pick(CITIES),
      avatar: "",
      avatarPublicId: "",
      isActive: "y",
      status: "y",
      isVerified: true,
      loginAttempts: 0,
      createdDate,
    });
  }
  const insertedUsers = await User.insertMany(userDocs);
  console.log(`✅ Đã tạo ${insertedUsers.length} users mới`);

  // ───────────────────────── Pool tổng hợp (cũ + mới) ─────────────────────────
  const allUserIds = [...existingUsers.map((u) => u._id), ...insertedUsers.map((u) => u._id)];
  const userInfoMap = new Map([
    ...existingUsers.map((u) => [String(u._id), u]),
    ...insertedUsers.map((u) => [String(u._id), u]),
  ]);

  const allTours = await Tour.find({}, { _id: 1, destination: 1, priceAdult: 1, priceChild: 1 }).lean();
  const tourMap = new Map(allTours.map((t) => [String(t._id), t]));

  const allDepartures = await TourDeparture.find({}, { _id: 1, tourId: 1 }).lean();

  // ───────────────────────── 4) BOOKINGS ─────────────────────────
  console.log("\n--- Tạo bookings mới ---");
  const existingCodes = new Set((await Booking.find({}, { code: 1 }).lean()).map((b) => b.code).filter(Boolean));

  const bookingDocs = [];
  for (let i = 0; i < N_BOOKINGS; i++) {
    const departure = pick(allDepartures);
    const tour = tourMap.get(String(departure.tourId));
    if (!tour) continue;

    const userId = pick(allUserIds);
    const userInfo = userInfoMap.get(String(userId));

    const numAdults = randInt(1, 4);
    const numChildren = Math.random() < 0.3 ? randInt(1, 2) : 0;
    const priceAdult = tour.priceAdult || 2000000;
    const priceChild = tour.priceChild || 1500000;
    const totalPrice = numAdults * priceAdult + numChildren * priceChild;

    const bookingStatus = pickWeighted(BOOKING_STATUS_WEIGHTS);
    let paidAmount = 0, depositPaid = false, cancelReason;
    if (bookingStatus === "completed") { paidAmount = totalPrice; depositPaid = true; }
    else if (bookingStatus === "confirmed") { paidAmount = Math.round(totalPrice * 0.5); depositPaid = true; }
    else if (bookingStatus === "cancelled") { cancelReason = pick(["Khách đổi lịch trình", "Khách hủy do bận việc cá nhân", "Không đủ số lượng khởi hành"]); }

    const createdAt = randomDateBetween(new Date(now.getTime() - 240 * 86400000), now);

    bookingDocs.push({
      tourDepartureId: departure._id,
      userId,
      fullName: userInfo?.fullName || "Khách hàng",
      email: userInfo?.email || "guest@example.com",
      phoneNumber: userInfo?.phoneNumber || "0900000000",
      address: userInfo?.address || "",
      numAdults,
      numChildren,
      totalPrice,
      bookingStatus,
      cancelReason,
      code: genCode(existingCodes),
      paidAmount,
      depositPaid,
      paymentMethod: pick(["momo", "vnpay", "manual"]),
      createdAt,
      updatedAt: createdAt,
    });
  }
  const insertedBookings = await Booking.insertMany(bookingDocs, { ordered: false });
  console.log(`✅ Đã tạo ${insertedBookings.length} bookings mới`);

  // ───────────────────────── 5) REVIEWS ─────────────────────────
  console.log("\n--- Tạo reviews mới ---");
  const existingReviewPairs = new Set(
    (await Review.find({}, { tourId: 1, userId: 1 }).lean()).map((r) => `${r.tourId}:${r.userId}`)
  );

  const tourIds = allTours.map((t) => t._id);
  const reviewDocs = [];
  let attempts = 0;
  while (reviewDocs.length < N_REVIEWS && attempts < N_REVIEWS * 10) {
    attempts++;
    const tourId = pick(tourIds);
    const userId = pick(allUserIds);
    const key = `${tourId}:${userId}`;
    if (existingReviewPairs.has(key)) continue;
    existingReviewPairs.add(key);

    const rating = Number(pickWeighted({ 5: 40, 4: 35, 3: 15, 2: 7, 1: 3 }));
    const createdAt = randomDateBetween(new Date(now.getTime() - 240 * 86400000), now);

    reviewDocs.push({
      tourId,
      userId,
      rating,
      comment: pick(REVIEW_COMMENTS[rating]),
      createdAt,
      updatedAt: createdAt,
    });
  }
  const insertedReviews = await Review.insertMany(reviewDocs, { ordered: false });
  console.log(`✅ Đã tạo ${insertedReviews.length} reviews mới`);

  // ───────────────────────── 6) USER INTERACTIONS ─────────────────────────
  console.log("\n--- Tạo user interactions mới ---");
  const interactionDocs = [];
  for (let i = 0; i < N_INTERACTIONS; i++) {
    const userId = pick(allUserIds);
    const tourId = pick(tourIds);
    const type = pickWeighted(INTERACTION_TYPE_WEIGHTS);
    const source = pickWeighted(SOURCE_WEIGHTS);

    let model = null;
    if (source === "homepage") model = pickWeighted({ deepfm: 55, hybrid: 35, popularity: 10 });
    else if (source === "similar") model = "hybrid";

    const position = ["click", "bookmark", "share"].includes(type) ? randInt(0, 5) : null;
    const duration = type === "view" ? randInt(5, 180) : null;
    const createdAt = randomDateBetween(new Date(now.getTime() - 90 * 86400000), now);
    const dateKey = createdAt.toISOString().slice(0, 10);

    interactionDocs.push({
      userId: new mongoose.Types.ObjectId(userId),
      tourId: new mongoose.Types.ObjectId(tourId),
      type,
      value: 1,
      source,
      model,
      position,
      sessionId: `${userId}-${dateKey}`,
      deviceType: pickWeighted(DEVICE_WEIGHTS),
      duration,
      createdAt,
      metadata: {},
    });
  }
  const interactionResult = await db.collection("tbl_user_interactions").insertMany(interactionDocs, { ordered: false });
  console.log(`✅ Đã tạo ${interactionResult.insertedCount} interactions mới`);

  console.log("\n🎉 HOÀN TẤT SEED DỮ LIỆU");
  console.log({
    tours: insertedTours.length,
    departures: insertedDepartures.length,
    users: insertedUsers.length,
    bookings: insertedBookings.length,
    reviews: insertedReviews.length,
    interactions: interactionResult.insertedCount,
  });

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Lỗi seed:", err);
  process.exit(1);
});
