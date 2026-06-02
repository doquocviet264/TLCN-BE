import { Router } from "express";
import { auth, leaderOnly, leaderOwnsDeparture } from "../middleware/auth.js";
import {
  leaderMyTours,
  leaderGetDeparture,
  leaderGetPassengers,
  leaderAddTimeline,
  leaderCreateExpense,
  leaderGetExpenses,
  leaderGetTourBookings,
  leaderUpdateBookingCheckin,
  leaderGetMe,
  leaderSubmitTourReport,
} from "../controllers/leader.controller.js";

const router = Router();

router.get("/me", auth, leaderOnly, leaderGetMe);

/**
 * @openapi
 * /api/leader/departures:
 *   get:
 *     tags: [Leader]
 *     summary: Danh sách Departure được phân công cho leader
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
router.get("/departures", auth, leaderOnly, leaderMyTours);

/**
 * @openapi
 * /api/leader/departures/{id}:
 *   get:
 *     tags: [Leader]
 *     summary: Chi tiết 1 Departure (chỉ departure được phân công)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Departure not found or not assigned to you }
 */
router.get("/departures/:id", auth, leaderOnly, leaderGetDeparture);

/**
 * @openapi
 * /api/leader/departures/{id}/passengers:
 *   get:
 *     tags: [Leader]
 *     summary: Danh sách hành khách đặt vé cho departure này
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Forbidden }
 */
router.get("/departures/:id/passengers", auth, leaderOnly, leaderGetPassengers);

/**
 * @openapi
 * /api/leader/departures/{id}/bookings/{bookingId}/checkin:
 *   patch:
 *     tags: [Leader]
 *     summary: Điểm danh (check-in) booking
 *     security: [ { bearerAuth: [] } ]
 */
router.patch("/departures/:id/bookings/:bookingId/checkin", auth, leaderOnly, leaderUpdateBookingCheckin);

/**
 * @openapi
 * /api/leader/departures/{id}/timeline:
 *   patch:
 *     tags: [Leader]
 *     summary: Leader thêm sự kiện timeline cho departure (chỉ departure được phân công)
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
 *             required: [eventType]
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [departed, arrived, checkpoint, note, finished]
 *               at:
 *                 type: string
 *                 format: date-time
 *               place:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       200: { description: Timeline updated }
 *       404: { description: Departure not found or not assigned to you }
 */
router.patch("/departures/:id/timeline", auth, leaderOnly, leaderOwnsDeparture, leaderAddTimeline);

router.patch("/departures/:id/report", auth, leaderOnly, leaderOwnsDeparture, leaderSubmitTourReport);

/**
 * @openapi
 * /api/leader/departures/{id}/expenses:
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
 *               amount:
 *                 type: number
 *               note:
 *                 type: string
 *               visibleToCustomers:
 *                 type: boolean
 *     responses:
 *       201: { description: Expense created }
 *       404: { description: Departure not found or not assigned to you }
 *   get:
 *     tags: [Leader]
 *     summary: Danh sách chi phí của departure
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post("/departures/:id/expenses", auth, leaderOnly, leaderOwnsDeparture, leaderCreateExpense);
router.get("/departures/:id/expenses",  auth, leaderOnly, leaderGetExpenses);

// ── Backward-compat: /tours → redirect sang /departures ──────────────
// Giữ để không break các client cũ đang call /leader/tours
router.get("/tours",              auth, leaderOnly, leaderMyTours);
router.get("/tours/:id",          auth, leaderOnly, leaderGetDeparture);
router.get("/tours/:id/bookings", auth, leaderOnly, leaderGetTourBookings);
router.post("/tours/:id/timeline", auth, leaderOnly, leaderOwnsDeparture, leaderAddTimeline);
router.post("/tours/:id/expenses", auth, leaderOnly, leaderOwnsDeparture, leaderCreateExpense);

export default router;
