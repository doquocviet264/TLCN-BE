import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  createBooking,
  onPaymentReceived,
  myBookings,
  cancelBookingByUser,
  getMyBookingDetail,
} from "../controllers/booking.controller.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Bookings
 *     description: API đặt tour với điều kiện đủ khách (gom khách + đặt cọc)
 *
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       properties:
 *         _id:           { type: string, example: "66f22b448cd79c9276c1d567" }
 *         tourId:        { type: string, example: "66f22b448cd79c9276c1d111" }
 *         userId:        { type: string, example: "66f22b448cd79c9276c1d222" }
 *         fullName:      { type: string, example: "Nguyễn Văn A" }
 *         email:         { type: string, example: "a@example.com" }
 *         phoneNumber:   { type: string, example: "0900000000" }
 *         address:       { type: string, example: "Hà Nội" }
 *         numAdults:     { type: integer, example: 2 }
 *         numChildren:   { type: integer, example: 1 }
 *         totalPrice:    { type: number, example: 799.97 }
 *         bookingStatus:
 *           type: string
 *           enum: [p, c, x]
 *           description: p=pending(gom khách), c=confirmed, x=canceled
 *         code:          { type: string, example: "BKABC123" }
 *         depositRate:   { type: number, example: 0.2 }
 *         depositAmount: { type: number, example: 160 }
 *         paidAmount:    { type: number, example: 160 }
 *         depositPaid:   { type: boolean, example: true }
 *         paymentMethod: { type: string, example: "momo" }
 *         paymentRefs:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               provider: { type: string, example: "momo" }
 *               ref:      { type: string, example: "TX123" }
 *               amount:   { type: number, example: 160 }
 *               at:       { type: string, example: "2025-12-01T10:00:00.000Z" }
 *         createdAt:     { type: string, example: "2025-09-20T03:30:00.000Z" }
 *         updatedAt:     { type: string, example: "2025-09-20T03:31:00.000Z" }
 *
 *     BookingCreateInput:
 *       type: object
 *       required: [tourId, numAdults, numChildren]
 *       properties:
 *         tourId:      { type: string, example: "66f22b448cd79c9276c1d111", description: "ObjectId tour" }
 *         numAdults:   { type: integer, example: 2 }
 *         numChildren: { type: integer, example: 1 }
 *         fullName:    { type: string, example: "Nguyễn Văn A" }
 *         email:       { type: string, example: "a@example.com" }
 *         phoneNumber: { type: string, example: "0900000000" }
 *         address:     { type: string, example: "Hà Nội" }
 *         paymentMethod:
 *           type: string
 *           example: "momo"
 *           description: "momo | vnpay | manual | cod"
 *
 *     BookingCreateResponse:
 *       type: object
 *       properties:
 *         message: { type: string, example: "Booking created, please pay deposit" }
 *         payUrl:  { type: string, example: "https://frontend.example/pay?code=BKABC123&amount=1600000" }
 *         booking: { $ref: "#/components/schemas/Booking" }
 *
 *     WebhookDepositInput:
 *       type: object
 *       required: [code, amount]
 *       properties:
 *         code:     { type: string, example: "BKABC123" }
 *         amount:   { type: number, example: 160 }
 *         provider: { type: string, example: "momo" }
 *         ref:      { type: string, example: "TX123456" }
 *
 *     BookingListResponse:
 *       type: object
 *       properties:
 *         total: { type: integer, example: 3 }
 *         page:  { type: integer, example: 1 }
 *         limit: { type: integer, example: 10 }
 *         data:
 *           type: array
 *           items: { $ref: "#/components/schemas/Booking" }
 */

/**
 * @openapi
 * /api/bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Tạo booking và nhận URL thanh toán tiền cọc
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/BookingCreateInput" }
 *     responses:
 *       201:
 *         description: Booking tạo thành công, trả về booking + payUrl
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/BookingCreateResponse" }
 *       400: { description: Invalid tourId or bad request }
 *       401: { description: Unauthorized }
 *       404: { description: Tour not found }
 */
router.post("/", auth, createBooking);

/**
 * @openapi
 * /api/bookings/deposit/webhook:
 *   post:
 *     tags: [Bookings]
 *     summary: Webhook/Return từ cổng thanh toán để xác nhận đã thanh toán cọc
 *     description: |
 *       **Lưu ý**: Production phải xác thực chữ ký/secret của cổng thanh toán.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/WebhookDepositInput" }
 *     responses:
 *       200:
 *         description: Ghi nhận thanh toán tiền cọc thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Deposit recorded" }
 *                 booking: { $ref: "#/components/schemas/Booking" }
 *       400: { description: Deposit amount not enough / Bad request }
 *       404: { description: Booking not found }
 */
router.post("/deposit/webhook", onPaymentReceived);

/**
 * @openapi
 * /api/bookings/me:
 *   get:
 *     tags: [Bookings]
 *     summary: Lấy danh sách booking của người dùng hiện tại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Danh sách booking (phân trang)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/BookingListResponse" }
 *       401: { description: Unauthorized }
 */
router.get("/me", auth, myBookings);

/**
 * @openapi
 * /api/bookings/{code}:
 *   get:
 *     tags: [Bookings]
 *     summary: Xem chi tiết 1 booking của tôi
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chi tiết booking
 *       404:
 *         description: Booking not found
 */
router.get("/:code", auth, getMyBookingDetail);

/**
 * @openapi
 * /api/bookings/{code}/cancel:
 *   put:
 *     tags: [Bookings]
 *     summary: Hủy booking khi còn trạng thái pending (p)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string, example: "BKABC123" }
 *     responses:
 *       200:
 *         description: Canceled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Canceled" }
 *                 booking: { $ref: "#/components/schemas/Booking" }
 *       400: { description: Only pending bookings can be canceled }
 *       401: { description: Unauthorized }
 *       404: { description: Booking not found }
 */
router.put("/:code/cancel", auth, cancelBookingByUser);

export default router;

