// src/routes/blog.routes.js
import { Router } from "express";
import { auth, adminOnly, optionalAuth } from "../middleware/auth.js";
import { uploadBlogMem } from "../middleware/upload.js";
import {
  listPublicPosts,
  getPostBySlug,
  getRelatedBlogsForTour,
  listAllPostsAdmin,
  getPostByIdAdmin,
  createPost,
  updatePost,
  deletePost,
  updatePostStatus,
  syncAllRatings,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  createPostUser,
  getMyPosts,
  updateOwnPost,
  deleteOwnPost,
  previewOwnPost,
  getOwnPostById
} from "../controllers/blog.controller.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     BlogComment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         fullName:
 *           type: string
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         content:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     BlogPost:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         slug:
 *           type: string
 *         summary:
 *           type: string
 *         content:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         coverImageUrl:
 *           type: string
 *         coverImagePublicId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [draft, published, archived]
 *         publishedAt:
 *           type: string
 *           format: date-time
 *         ratingAvg:
 *           type: number
 *         ratingCount:
 *           type: integer
 *         comments:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/BlogComment"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/blog:
 *   get:
 *     tags: [Blog]
 *     summary: Danh sách bài blog (public - chỉ published)
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
 *           default: 10
 *           maximum: 50
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/", optionalAuth, listPublicPosts);

/**
 * @openapi
 * /api/blog/related-to-tour/{tourId}:
 *   get:
 *     tags: [Blog]
 *     summary: Lấy 1-2 blog liên quan đến tour (tự động tìm theo keyword)
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
router.get("/related-to-tour/:tourId", getRelatedBlogsForTour);

/**
 * @openapi
 * /api/blog/{slug}:
 *   get:
 *     tags: [Blog]
 *     summary: Chi tiết bài blog theo slug (public)
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */
router.get("/:slug", getPostBySlug);

/** ========== USER ROUTES ========== */
router.post("/user", auth, uploadBlogMem.single("cover"), createPostUser);
router.get("/user/my-posts", auth, getMyPosts);
router.get("/user/preview/:slug", auth, previewOwnPost);
router.get("/user/:id", auth, getOwnPostById);
router.put("/user/:id", auth, uploadBlogMem.single("cover"), updateOwnPost);
router.delete("/user/:id", auth, deleteOwnPost);
/**
 * @openapi
 * /api/blog/admin/list:
 *   get:
 *     tags: [Blog-Admin]
 *     summary: Danh sách blog (admin - mọi trạng thái)
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
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/admin/list", auth, adminOnly, listAllPostsAdmin);

/**
 * @openapi
 * /api/blog/admin/{id}:
 *   get:
 *     tags: [Blog-Admin]
 *     summary: Chi tiết blog (admin)
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
 *       404:
 *         description: Not found
 */
router.get("/admin/:id", auth, adminOnly, getPostByIdAdmin);

/**
 * @openapi
 * /api/blog/admin:
 *   post:
 *     tags: [Blog-Admin]
 *     summary: Tạo bài blog (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               summary:
 *                 type: string
 *               content:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               coverImageUrl:
 *                 type: string
 *               coverImagePublicId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *                 default: draft
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/admin", auth, adminOnly, createPost);

/**
 * @openapi
 * /api/blog/admin/{id}:
 *   put:
 *     tags: [Blog-Admin]
 *     summary: Cập nhật bài blog (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: OK
 *   delete:
 *     tags: [Blog-Admin]
 *     summary: Xoá bài blog (admin)
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
 *         description: Deleted
 */
router.put("/admin/:id", auth, adminOnly, updatePost);
router.delete("/admin/:id", auth, adminOnly, deletePost);

/**
 * @openapi
 * /api/blog/admin/{id}/status:
 *   patch:
 *     tags: [Blog-Admin]
 *     summary: Cập nhật status bài blog (draft/published/archived)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch("/admin/:id/status", auth, adminOnly, updatePostStatus);

// POST /api/blog/admin/sync-ratings — chạy 1 lần để migrate rating từ data cũ
router.post("/admin/sync-ratings", auth, adminOnly, syncAllRatings);

/**
 * @openapi
 * /api/blog/{slug}/comments:
 *   get:
 *     tags: [Blog]
 *     summary: Xem danh sách comment + rating cho blog
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 *   post:
 *     tags: [Blog]
 *     summary: Thêm comment + rating cho blog (user đã đăng nhập)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating, content]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 */
router.get("/:slug/comments", listComments);
router.post("/:slug/comments", auth, addComment);

/**
 * @openapi
 * /api/blog/{slug}/comments/{commentId}:
 *   patch:
 *     tags: [Blog]
 *     summary: Sửa comment (chủ comment hoặc admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated
 *   delete:
 *     tags: [Blog]
 *     summary: Xoá comment (chủ comment hoặc admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 */
router.patch("/:slug/comments/:commentId", auth, updateComment);
router.delete("/:slug/comments/:commentId", auth, deleteComment);

export default router;
