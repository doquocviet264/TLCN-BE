import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./config/passport.js";
import path from "node:path";
import authRouter from "./routes/auth.routes.js";
import tourRouter from "./routes/tour.routes.js";
import adminRouter from "./routes/admin.routes.js";
import userRouter from "./routes/user.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import adminBookingRoutes from "./routes/admin-booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import leaderAuthRoutes from "./routes/leader.auth.routes.js";
import leaderRoutes from "./routes/leader.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import swaggerUi from "swagger-ui-express";
import chatRoutes from "./routes/chat.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import { swaggerSpec } from "./config/swagger.js";
import blogRouter from "./routes/blog.routes.js";
import checkinRoutes from "./routes/checkin.routes.js";
import wardRoutes from "./routes/ward.routes.js";
import recommendationRoutes from "./routes/recommendations.routes.js";
import voucherRoutes from "./routes/voucher.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import travelMemoryRoutes from "./routes/travelMemory.routes.js";
import journeyRoutes from "./routes/journey.routes.js";
import contactRoutes from "./routes/contact.routes.js";

import { registerConfirmOrRefundJob } from "./jobs/confirmOrRefund.job.js";
import { registerNotificationJobs } from "./jobs/notification.jobs.js";

const app = express();

app.use("/uploads", express.static(path.resolve("uploads")));

/* =========================
 *  CORS + BODY + COOKIES
 * ========================= */
const isProd = process.env.NODE_ENV === "production";
const ALLOW_ORIGINS = (
  process.env.CORS_ORIGINS ||
  "http://localhost:4000,http://127.0.0.1:4000,http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim());

app.set("trust proxy", 1);

/* =========================
 *  SECURITY HEADERS (Helmet)
 * ========================= */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (!isProd) return cb(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

/* =========================
 *  NOSQL INJECTION PREVENTION
 * ========================= */
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

/* =========================
 *  RATE LIMITING
 * ========================= */
// General API: 200 req / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
});

// Auth endpoints: 20 req / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau 15 phút." },
});

app.use("/api/", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

/* =========================
 *  SESSION + PASSPORT
 * ========================= */
app.use(
  session({
    secret: process.env.JWT_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      httpOnly: true,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

/* =========================
 *  ROUTES
 * ========================= */
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Swagger đặt TRƯỚC 404
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRouter);
app.use("/api/tours", tourRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/bookings", adminBookingRoutes);
app.use("/api/users", userRouter);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/leader", leaderAuthRoutes);
app.use("/api/leader", leaderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/blog", blogRouter);
app.use("/api/chat", chatRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/ward", wardRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/travel-memories", travelMemoryRoutes);
app.use("/api/journey", journeyRoutes);
app.use("/api/contact", contactRoutes);

/* =========================
 *  404 FALLBACK
 * ========================= */
app.use((req, res) => res.status(404).json({ message: "Not Found" }));

/* =========================
 *  CRON JOBS
 * ========================= */
registerConfirmOrRefundJob();
registerNotificationJobs();

export default app;
