import { Router } from "express";
import { auth, leaderOnly, leaderOwnsTour } from "../middleware/auth.js";
import { leaderMyTours, leaderAddTimeline, leaderCreateExpense } from "../controllers/leader.controller.js";

const router = Router();

/**
 * @openapi
 * /api/leader/tours:
 *   get:
 *     tags: [Leader]
 *     summary: Danh sách tour được phân công cho leader
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, in_progress, completed, closed] }
 *       - in: query
 *         name: onlyToday
 *         schema: { type: integer, enum: [0,1], default: 0 }
 *     responses:
 *       200: { description: OK }
 */
router.get("/tours", auth, leaderOnly, leaderMyTours);

/**
 * @openapi
 * /api/leader/tours/{id}/timeline:
 *   post:
 *     tags: [Leader]
 *     summary: Leader thêm sự kiện timeline cho tour (chỉ tour được phân công)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "68f30a0c9a9e2d9f3f8b5c10" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventType]
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [departed, arrived, checkpoint, note, finished]
 *               at:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-12-01T07:30:00.000Z"
 *               place:
 *                 type: string
 *                 example: "Hà Nội"
 *               note:
 *                 type: string
 *                 example: "Xuất phát đúng giờ"
 *     responses:
 *       200: { description: Timeline updated }
 *       404: { description: Tour not found or not assigned to you }
 */
router.post("/tours/:id/timeline", auth, leaderOnly, leaderOwnsTour, leaderAddTimeline);

/**
 * @openapi
 * /api/leader/tours/{id}/expenses:
 *   post:
 *     tags: [Leader]
 *     summary: Leader thêm chi phí phát sinh (occurredAt = thời gian server)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, amount]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Ăn trưa đoàn"
 *               amount:
 *                 type: number
 *                 example: 1200000
 *               note:
 *                 type: string
 *                 example: "Nhà hàng A"
 *               visibleToCustomers:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201: { description: Expense created }
 *       404: { description: Tour not found or not assigned to you }
 */
router.post("/tours/:id/expenses", auth, leaderOnly, leaderOwnsTour, leaderCreateExpense);

export default router;
