import express from "express";
import cors from "cors";
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
import { swaggerSpec } from "./config/swagger.js";
import blogRouter from "./routes/blog.routes.js";


import { registerConfirmOrRefundJob } from "./jobs/confirmOrRefund.job.js";

const app = express();

app.use("/uploads", express.static(path.resolve("uploads")));
/* =========================
 *  CORS + BODY + COOKIES
 * ========================= */
const isProd = process.env.NODE_ENV === "production";
const ALLOW_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:4000,http://127.0.0.1:4000,http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map(s => s.trim());

app.set("trust proxy", true); // cần cho cookie secure khi deploy sau này

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // Postman/cURL
      if (!isProd) return cb(null, true);  {
        return cb(null, true);
      }
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// preflight nhanh
//app.options("*", cors());

app.use(express.json());
app.use(cookieParser());

/* =========================
 *  SESSION + PASSPORT
 *  (dùng cho OAuth Google)
 * ========================= */
app.use(
  session({
    secret: process.env.JWT_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,                // production (https) = true
      sameSite: isProd ? "none" : "lax",
      httpOnly: true,
    },
  })
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
app.use("/api/chat", chatRoutes);
app.use("/api/blog", blogRouter);
/* =========================
 *  404 FALLBACK
 * ========================= */
app.use((req, res) => res.status(404).json({ message: "Not Found" }));

/* =========================
 *  CRON JOBS
 * ========================= */
registerConfirmOrRefundJob();

export default app;
