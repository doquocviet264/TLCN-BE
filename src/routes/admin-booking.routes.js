import { Router } from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { adminOnly } from "../middleware/auth.js";
import {
  getAdminBookings,
  getAdminBookingById,
  updateAdminBookingStatus,
  deleteAdminBooking,
  getAdminBookingByCode,
  updateAdminBookingPayment,
  bulkMarkBookingsPaid,
  refundBookingPayment,
  getPaymentStats,
  getPaymentHistory,
} from "../controllers/booking.controller.js";

const router = Router();

// Middleware to validate :id is a valid MongoDB ObjectId
// If not valid, skip to next middleware/route
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return next("route");
  }
  next();
};

/**
 * @openapi
 * tags:
 *   - name: Admin Bookings
 *     description: Admin API để quản lý booking, thanh toán và doanh thu
 */

/**
 * @openapi
 * /api/admin/bookings:
 *   get:
 *     tags: [Admin Bookings]
 *     summary: Danh sách tất cả bookings (admin only) - hỗ trợ phân trang, tìm kiếm, lọc
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [p, c, x]
 *       - in: query
 *         name: tourId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/", auth, adminOnly, getAdminBookings);

/**
 * @openapi
 * /api/admin/bookings/bulk/mark-paid:
 *   post:
 *     tags: [Admin Bookings]
 *     summary: Xác nhận thanh toán hàng loạt cho nhiều booking (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingIds]
 *             properties:
 *               bookingIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["63f1234567890abcdef12345", "63f1234567890abcdef12346"]
 *               amount:
 *                 type: number
 *                 example: 1000000
 *                 description: "Số tiền per booking (optional, mặc định là số tiền còn lại)"
 *               provider:
 *                 type: string
 *                 example: "manual"
 *               note:
 *                 type: string
 *                 example: "Thanh toán qua chuyển khoản ngân hàng"
 *     responses:
 *       200:
 *         description: OK - Cập nhật thành công hàng loạt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: number
 *                 bookings:
 *                   type: array
 */
router.post("/bulk/mark-paid", auth, adminOnly, bulkMarkBookingsPaid);

/**
 * @openapi
 * /api/admin/bookings/code/{code}:
 *   get:
 *     tags: [Admin Bookings]
 *     summary: Lấy booking theo code (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/code/:code", auth, adminOnly, getAdminBookingByCode);

/**
 * @openapi
 * /api/admin/bookings/stats/payments:
 *   get:
 *     tags: [Admin Bookings]
 *     summary: Thống kê doanh thu theo phương thức thanh toán (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: OK - Thống kê doanh thu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: object
 *                 byPaymentMethod:
 *                   type: array
 *                 summary:
 *                   type: object
 */
router.get("/stats/payments", auth, adminOnly, getPaymentStats);

/**
 * @openapi
 * /api/admin/bookings/{id}:
 *   get:
 *     tags: [Admin Bookings]
 *     summary: Chi tiết 1 booking (admin only)
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
 *         description: OK
 */
router.get("/:id", auth, adminOnly, validateObjectId, getAdminBookingById);

/**
 * @openapi
 * /api/admin/bookings/{id}/status:
 *   patch:
 *     tags: [Admin Bookings]
 *     summary: Cập nhật trạng thái booking (admin only)
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
 *               status:
 *                 type: string
 *                 enum: [p, c, x]
 *     responses:
 *       200:
 *         description: OK
 */
router.patch("/:id/status", auth, adminOnly, validateObjectId, updateAdminBookingStatus);

/**
 * @openapi
 * /api/admin/bookings/{id}/payment:
 *   patch:
 *     tags: [Admin Bookings]
 *     summary: Cập nhật trạng thái thanh toán booking (COD/Manual only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "63f1234567890abcdef12345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [mark_paid]
 *                 example: "mark_paid"
 *               amount:
 *                 type: number
 *                 example: 1000000
 *                 description: "Số tiền thanh toán (optional, mặc định là số tiền còn lại)"
 *               provider:
 *                 type: string
 *                 example: "manual"
 *                 description: "Nhà cung cấp thanh toán (mặc định: manual)"
 *               ref:
 *                 type: string
 *                 example: "CASH_001"
 *                 description: "Mã tham chiếu thanh toán"
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payment updated successfully"
 *                 booking:
 *                   type: object
 *       400:
 *         description: Chỉ hỗ trợ COD hoặc Manual payment
 */
router.patch("/:id/payment", auth, adminOnly, validateObjectId, updateAdminBookingPayment);

/**
 * @openapi
 * /api/admin/bookings/{id}/refund:
 *   post:
 *     tags: [Admin Bookings]
 *     summary: Hoàn lại tiền cho booking (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
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
 *               refundAmount:
 *                 type: number
 *                 example: 500000
 *                 description: "Số tiền hoàn (optional, mặc định hoàn toàn bộ)"
 *               reason:
 *                 type: string
 *                 example: "Khách hủy tour"
 *               refundRef:
 *                 type: string
 *                 example: "REF_001"
 *     responses:
 *       200:
 *         description: OK - Hoàn tiền thành công
 */
router.post("/:id/refund", auth, adminOnly, validateObjectId, refundBookingPayment);

/**
 * @openapi
 * /api/admin/bookings/{id}/payment-history:
 *   get:
 *     tags: [Admin Bookings]
 *     summary: Xem lịch sử thanh toán của booking (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK - Chi tiết lịch sử thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 booking:
 *                   type: object
 *                 paymentHistory:
 *                   type: array
 */
router.get("/:id/payment-history", auth, adminOnly, validateObjectId, getPaymentHistory);

/**
 * @openapi
 * /api/admin/bookings/{id}:
 *   delete:
 *     tags: [Admin Bookings]
 *     summary: Xoá 1 booking (admin only)
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
 *         description: OK
 */
router.delete("/:id", auth, adminOnly, validateObjectId, deleteAdminBooking);

export default router;
