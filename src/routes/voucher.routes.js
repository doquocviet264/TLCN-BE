import { Router } from "express";
import { auth, adminOnly } from "../middleware/auth.js";
import {
  createVoucher,
  getVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  applyVoucher
} from "../controllers/voucher.controller.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Vouchers
 *     description: API quản lý mã giảm giá (Voucher)
 */

// User routes
/**
 * @openapi
 * /api/vouchers/apply:
 *   post:
 *     tags: [Vouchers]
 *     summary: Áp dụng mã giảm giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, totalPrice]
 *             properties:
 *               code: { type: string, example: "SUMMER2026" }
 *               totalPrice: { type: number, example: 5000000 }
 *               tourId: { type: string, description: "ObjectId của tour (nếu voucher áp dụng riêng cho tour)" }
 *     responses:
 *       200:
 *         description: Trả về số tiền giảm
 *       400:
 *         description: Voucher không hợp lệ
 */
router.post("/apply", applyVoucher); 
router.post("/validate", applyVoucher); 
router.get("/me", auth, getMyVouchers);

// Admin routes
/**
 * @openapi
 * /api/vouchers:
 *   get:
 *     tags: [Vouchers]
 *     summary: Lấy danh sách voucher (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *   post:
 *     tags: [Vouchers]
 *     summary: Tạo voucher mới (Admin)
 *     security:
 *       - bearerAuth: []
 */
router.get("/", auth, adminOnly, getVouchers);
router.post("/", auth, adminOnly, createVoucher);

/**
 * @openapi
 * /api/vouchers/{id}:
 *   get:
 *     tags: [Vouchers]
 *     summary: Xem chi tiết voucher (Admin)
 *     security:
 *       - bearerAuth: []
 *   put:
 *     tags: [Vouchers]
 *     summary: Cập nhật voucher (Admin)
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [Vouchers]
 *     summary: Xóa voucher (Admin)
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", auth, adminOnly, getVoucherById);
router.put("/:id", auth, adminOnly, updateVoucher);
router.delete("/:id", auth, adminOnly, deleteVoucher);

export default router;
