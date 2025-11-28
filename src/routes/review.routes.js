import { Router } from "express";
import { auth, adminOnly } from "../middleware/auth.js";
import {
  createReview,
  getReviewsOfTour,
  myReviews,
  getAdminReviews,
  deleteAdminReview,
  updateAdminReview,
} from "../controllers/review.controller.js";

const router = Router();

// ==================== PUBLIC ROUTES ====================

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Tạo/sửa đánh giá tour (chỉ user đã hoàn thành tour)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tourId, rating]
 *             properties:
 *               tourId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review saved
 */
router.post("/", auth, createReview);

/**
 * @openapi
 * /api/reviews/tour/{tourId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Danh sách review của 1 tour + rating trung bình
 *     parameters:
 *       - in: path
 *         name: tourId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/tour/:tourId", getReviewsOfTour);

/**
 * @openapi
 * /api/reviews/me:
 *   get:
 *     tags: [Reviews]
 *     summary: Review của chính tôi
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/me", auth, myReviews);

// ==================== ADMIN ROUTES ====================

/**
 * @openapi
 * /api/reviews/admin:
 *   get:
 *     tags: [Reviews Admin]
 *     summary: Danh sách tất cả reviews (admin only) - hỗ trợ phân trang, tìm kiếm, lọc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: tourId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/admin", auth, adminOnly, getAdminReviews);

/**
 * @openapi
 * /api/reviews/admin/{id}:
 *   delete:
 *     tags: [Reviews Admin]
 *     summary: Xoá một review (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted
 */
router.delete("/admin/:id", auth, adminOnly, deleteAdminReview);

/**
 * @openapi
 * /api/reviews/admin/{id}:
 *   put:
 *     tags: [Reviews Admin]
 *     summary: Chỉnh sửa một review (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated
 */
router.put("/admin/:id", auth, adminOnly, updateAdminReview);

export default router;
