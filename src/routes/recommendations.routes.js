import express from "express";
import axios from "axios";

const router = express.Router();

const REC_BASE = process.env.RECOMMENDATION_API || "http://localhost:8000";
const REC_TIMEOUT = 3000; // 3s — nếu Python service chậm thì trả [] chứ không chờ

/* ─────────────────────────────────────────────
 *  Helper: gọi Python FastAPI, luôn trả mảng
 *  Không bao giờ throw → app không crash nếu
 *  recommendation service down
 * ───────────────────────────────────────────── */
async function fetchRec(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${REC_BASE}${endpoint}`, {
      params,
      timeout: REC_TIMEOUT,
    });
    return Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    // Log nhẹ để debug, không crash server
    console.warn(`[Recommendation] ${endpoint} failed:`, err.message);
    return [];
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
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const limit = parseInt(req.query.limit) || 6;
    const data = await fetchRec("/recommend/homepage", { userId, limit });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[Recommendation] /homepage error:", err.message);
    return res.json({ success: true, data: [] });
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
      return res.json({ success: true, data: [] });
    }

    const limit = parseInt(req.query.limit) || 4;
    const data = await fetchRec("/recommend/similar", { tourId, limit });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[Recommendation] /similar error:", err.message);
    return res.json({ success: true, data: [] });
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
    const userId = req.user?._id?.toString();
    const limit = parseInt(req.query.limit) || 4;

    if (!tourId) {
      return res.json({ success: true, data: [] });
    }

    // Nếu chưa đăng nhập → fallback về similar (không lọc theo user)
    if (!userId) {
      const data = await fetchRec("/recommend/similar", { tourId, limit });
      return res.json({ success: true, data });
    }

    const data = await fetchRec("/recommend/post-booking", {
      tourId,
      userId,
      limit,
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[Recommendation] /post-booking error:", err.message);
    return res.json({ success: true, data: [] });
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