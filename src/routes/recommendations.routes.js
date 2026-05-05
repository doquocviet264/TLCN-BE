import express from "express";
import axios from "axios";

const router = express.Router();

const REC_BASE = process.env.RECOMMENDATION_API || "http://localhost:8000";
const REC_TIMEOUT = 10000; // 10s — cho phép thời gian warm-up model

/* ─────────────────────────────────────────────
 *  Helper: gọi Python FastAPI, trả { data, model }
 *  Không bao giờ throw → app không crash nếu
 *  recommendation service down
 * ───────────────────────────────────────────── */
async function fetchRec(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${REC_BASE}${endpoint}`, {
      params,
      timeout: REC_TIMEOUT,
    });
    return {
      data: Array.isArray(data?.data) ? data.data : [],
      model: data?.model || null
    };
  } catch (err) {
    // Log nhẹ để debug, không crash server
    console.warn(`[Recommendation] ${endpoint} failed:`, err.message);
    return { data: [], model: null };
  }
}

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/homepage
 *  Gợi ý cá nhân hóa cho trang chủ
 *  - Đã đăng nhập → dùng lịch sử booking
 *  - Chưa đăng nhập → trả [] (frontend ẩn section)
 * ───────────────────────────────────────────── */
router.get("/homepage", async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.query.userId || null;
    const limit = parseInt(req.query.limit) || 6;

    // Build params, only include userId if it exists
    const params = { limit };
    if (userId) params.userId = userId;

    const result = await fetchRec("/recommend/homepage", params);

    return res.json({ success: true, data: result.data, model: result.model });
  } catch (err) {
    console.error("[Recommendation] /homepage error:", err.message);
    return res.json({ success: true, data: [], model: null });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/similar/:tourId
 *  Tour tương tự trên trang chi tiết tour
 *  - Không cần đăng nhập
 * ───────────────────────────────────────────── */
router.get("/similar/:tourId", async (req, res) => {
  try {
    const { tourId } = req.params;

    if (!tourId) {
      return res.json({ success: true, data: [], model: null });
    }

    const limit = parseInt(req.query.limit) || 4;
    const result = await fetchRec("/recommend/similar", { tourId, limit });

    return res.json({ success: true, data: result.data, model: result.model });
  } catch (err) {
    console.error("[Recommendation] /similar error:", err.message);
    return res.json({ success: true, data: [], model: null });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/post-booking/:tourId
 *  Gợi ý sau khi đặt tour thành công
 *  - Cần đăng nhập (để loại tour đã đặt)
 *  - Nếu chưa đăng nhập → fallback similarity thuần
 * ───────────────────────────────────────────── */
router.get("/post-booking/:tourId", async (req, res) => {
  try {
    const { tourId } = req.params;
    const userId = req.user?._id?.toString() || req.query.userId || null;
    const limit = parseInt(req.query.limit) || 4;

    if (!tourId) {
      return res.json({ success: true, data: [], model: null });
    }

    // Nếu chưa đăng nhập → fallback về similar (không lọc theo user)
    if (!userId) {
      const result = await fetchRec("/recommend/similar", { tourId, limit });
      return res.json({ success: true, data: result.data, model: result.model });
    }

    const result = await fetchRec("/recommend/post-booking", {
      tourId,
      userId,
      limit,
    });

    return res.json({ success: true, data: result.data, model: result.model });
  } catch (err) {
    console.error("[Recommendation] /post-booking error:", err.message);
    return res.json({ success: true, data: [], model: null });
  }
});

/* ─────────────────────────────────────────────
 *  POST /api/recommendations/track
 *  Track user interaction với recommendations
 *  - Lưu vào DB để analytics
 *  - Update DeepFM model (online learning)
 * ───────────────────────────────────────────── */
router.post("/track", async (req, res) => {
  try {
    // Forward tracking request to Python service
    const { data } = await axios.post(`${REC_BASE}/recommend/track`, req.body, {
      timeout: 5000,
      headers: { "Content-Type": "application/json" },
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    // Tracking should fail silently - don't break the app
    console.warn("[Recommendation] /track failed:", err.message);
    return res.json({ success: true, status: "skipped" });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/analytics/metrics
 *  Lấy CTR, conversion rate
 * ───────────────────────────────────────────── */
router.get("/analytics/metrics", async (req, res) => {
  try {
    const { data } = await axios.get(`${REC_BASE}/recommend/analytics/metrics`, {
      params: req.query,
      timeout: 5000,
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.warn("[Recommendation] /analytics/metrics failed:", err.message);
    return res.status(503).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/analytics/ab-test
 *  So sánh DeepFM vs Hybrid
 * ───────────────────────────────────────────── */
router.get("/analytics/ab-test", async (req, res) => {
  try {
    const { data } = await axios.get(`${REC_BASE}/recommend/analytics/ab-test`, {
      params: req.query,
      timeout: 5000,
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.warn("[Recommendation] /analytics/ab-test failed:", err.message);
    return res.status(503).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/analytics/daily
 *  Thống kê theo ngày
 * ───────────────────────────────────────────── */
router.get("/analytics/daily", async (req, res) => {
  try {
    const { data } = await axios.get(`${REC_BASE}/recommend/analytics/daily`, {
      params: req.query,
      timeout: 5000,
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.warn("[Recommendation] /analytics/daily failed:", err.message);
    return res.status(503).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/model/info
 *  Thông tin về recommendation models
 * ───────────────────────────────────────────── */
router.get("/model/info", async (req, res) => {
  try {
    const { data } = await axios.get(`${REC_BASE}/recommend/model/info`, {
      timeout: 3000,
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.warn("[Recommendation] /model/info failed:", err.message);
    return res.status(503).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────
 *  GET /api/recommendations/health
 *  Kiểm tra Python service còn sống không
 *  Dùng để debug, không cần đăng nhập
 * ───────────────────────────────────────────── */
router.get("/health", async (req, res) => {
  try {
    const { data } = await axios.get(`${REC_BASE}/health`, {
      timeout: 2000,
    });
    return res.json({ success: true, pythonService: data });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: "Recommendation service unavailable",
      detail: err.message,
    });
  }
});

export default router;