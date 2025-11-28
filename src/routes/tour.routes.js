import { Router } from "express";
import {
  getTours,
  getTourById,
  createTour,
  updateTour,
  deleteTour,
  searchTours,
  suggestDestinations
} from "../controllers/tour.controller.js";
import {
  getAllTours,
  getTourByIdAdmin,
  createTourAdmin,
  updateTourAdmin,
  deleteTourAdmin
} from "../controllers/admin.controller.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ItinerarySegment:
 *       type: object
 *       properties:
 *         timeOfDay: { type: string, enum: [morning, afternoon, evening] }
 *         title: { type: string, example: "Buổi sáng" }
 *         items:
 *           type: array
 *           items: { type: string, example: "Tham quan vịnh Hạ Long" }
 *     ItineraryDay:
 *       type: object
 *       properties:
 *         day: { type: integer, example: 1 }
 *         title: { type: string, example: "Hà Nội – Hạ Long" }
 *         summary: { type: string, example: "Di chuyển và tham quan đầu ngày." }
 *         segments:
 *           type: array
 *           items: { $ref: "#/components/schemas/ItinerarySegment" }
 *         photos:
 *           type: array
 *           items: { type: string, example: "https://loremflickr.com/800/600/halong?lock=halong-day-1" }
 *     Tour:
 *       type: object
 *       properties:
 *         _id: { type: string, example: "66f22b448cd79c9276c1d567" }
 *         title: { type: string, example: "Hạ Long Bay 3N2Đ" }
 *         time: { type: string, example: "3 ngày 2 đêm" }
 *         description: { type: string, example: "Tham quan vịnh Hạ Long..." }
 *         quantity: { type: integer, example: 30 }
 *         priceAdult: { type: number, example: 299.99 }
 *         priceChild: { type: number, example: 199.99 }
 *         destination: { type: string, example: "Quảng Ninh" }
 *         destinationSlug: { type: string, example: "quang ninh" }
 *         startDate: { type: string, example: "2025-12-01T00:00:00.000Z" }
 *         endDate: { type: string, example: "2025-12-03T00:00:00.000Z" }
 *         images:
 *           type: array
 *           items: { type: string, example: "https://loremflickr.com/1200/800/halong?lock=halong-1" }
 *         itinerary:
 *           type: array
 *           items: { $ref: "#/components/schemas/ItineraryDay" }
 *     TourCreateInput:
 *       type: object
 *       required: [title, destination]
 *       properties:
 *         title: { type: string }
 *         time: { type: string }
 *         description: { type: string }
 *         quantity: { type: integer }
 *         priceAdult: { type: number }
 *         priceChild: { type: number }
 *         destination: { type: string, example: "Quảng Ninh" }
 *         startDate: { type: string, example: "2025-12-01" }
 *         endDate: { type: string, example: "2025-12-03" }
 *         images:
 *           type: array
 *           items: { type: string, example: "https://loremflickr.com/1200/800/halong?lock=halong-2" }
 *         itinerary:
 *           type: array
 *           items: { $ref: "#/components/schemas/ItineraryDay" }
 *     TourSearchResponse:
 *       type: object
 *       properties:
 *         total: { type: integer, example: 42 }
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 10 }
 *         data:
 *           type: array
 *           items: { $ref: "#/components/schemas/Tour" }
 */

/**
 * @openapi
 * /api/tours/suggest:
 *   get:
 *     tags: [Tours]
 *     summary: Gợi ý địa điểm theo prefix (không cần đăng nhập)
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         schema: { type: string, example: "ha" }
 *         description: Tiền tố người dùng đang gõ (bỏ dấu, không phân biệt hoa thường)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 8, maximum: 20 }
 *     responses:
 *       200:
 *         description: Mảng gợi ý địa điểm
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: string, example: "Hạ Long" }
 */
router.get("/suggest", suggestDestinations);

/**
 * @openapi
 * /api/tours/search:
 *   get:
 *     tags: [Tours]
 *     summary: Tìm kiếm tour theo địa điểm, thời gian, ngân sách, từ khóa
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string, example: "vinh ha long" }
 *         description: Từ khóa tự do (so khớp title/description/destination)
 *       - in: query
 *         name: destination
 *         schema: { type: string, example: "ha noi" }
 *         description: Nơi muốn đến (có thể chỉ là tiền tố, ví dụ "ha")
 *       - in: query
 *         name: from
 *         schema: { type: string, example: "2025-12-01" }
 *         description: Ngày đi sớm nhất (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema: { type: string, example: "2025-12-31" }
 *         description: Ngày về muộn nhất (YYYY-MM-DD)
 *       - in: query
 *         name: budgetMin
 *         schema: { type: number, example: 100 }
 *       - in: query
 *         name: budgetMax
 *         schema: { type: number, example: 500 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm (phân trang)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/TourSearchResponse" }
 */
router.get("/search", searchTours);

/**
 * @openapi
 * /api/tours/admin:
 *   get:
 *     tags: [Tours]
 *     summary: Danh sách tất cả tours cho admin (có phân trang và filter)
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
 *           enum: [pending, confirmed, in_progress, completed, closed]
 *       - in: query
 *         name: destination
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo title, description, destination
 *     responses:
 *       200:
 *         description: Danh sách tours
 */
router.get("/admin", auth, adminOnly, getAllTours);

/**
 * @openapi
 * /api/tours:
 *   get:
 *     tags: [Tours]
 *     summary: Danh sách tour (phân trang & lọc)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: destination
 *         schema: { type: string, example: "ha noi" }
 *       - in: query
 *         name: title
 *         schema: { type: string, example: "Hạ Long" }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/TourSearchResponse" }
 */
router.get("/", getTours);

/**
 * @openapi
 * /api/tours/{id}:
 *   get:
 *     tags: [Tours]
 *     summary: Chi tiết tour
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Tour" }
 *       400: { description: Invalid tour id }
 *       404: { description: Tour not found }
 */
router.get("/:id", getTourById);

/**
 * @openapi
 * /api/tours/admin/{id}:
 *   get:
 *     tags: [Tours]
 *     summary: Chi tiết tour cho admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *     responses:
 *       200:
 *         description: OK
 *       404: { description: Tour not found }
 */
router.get("/admin/:id", auth, adminOnly, getTourByIdAdmin);

/**
 * @openapi
 * /api/tours:
 *   post:
 *     tags: [Tours]
 *     summary: Tạo tour (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/TourCreateInput" }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Tour" }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.post("/", auth, adminOnly, createTourAdmin);

/**
 * @openapi
 * /api/tours/{id}:
 *   put:
 *     tags: [Tours]
 *     summary: Cập nhật tour (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/TourCreateInput" }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Tour" }
 *       400: { description: Invalid tour id }
 *       404: { description: Tour not found }
 */
router.put("/:id", auth, adminOnly, updateTourAdmin);

/**
 * @openapi
 * /api/tours/{id}:
 *   delete:
 *     tags: [Tours]
 *     summary: Xoá tour (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-fA-F]{24}$"
 *     responses:
 *       200: { description: Tour deleted }
 *       400: { description: Invalid tour id }
 *       404: { description: Tour not found }
 */
router.delete("/:id", auth, adminOnly, deleteTourAdmin);


export default router;
