import { Router } from "express";
import { auth, adminOnly } from "../middleware/auth.js";
import { 
  getMyProfile, updateMyProfile, changePassword,
  uploadMyAvatar, uploadMyAvatarCloud,
  getAllUsers, getUserById, createUserAdmin, updateUserAdmin, resetUserPassword, deleteUser
} from "../controllers/user.controller.js";
import { uploadAvatarMulter, uploadAvatarMem } from "../middleware/upload.js";
import { passwordValidator } from "../utils/passwordValidator.js";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";

const VN_PHONE = /^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/;

const router = Router();

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Xem hồ sơ của chính mình
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: OK }
 */
router.get("/me", auth, getMyProfile);

/**
 * @openapi
 * /api/users/me:
 *   put:
 *     tags: [Users]
 *     summary: Cập nhật hồ sơ (fullName, phoneNumber, address, avatar, username)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: "Nguyen Van A" }
 *               phoneNumber: { type: string, example: "0912345678" }
 *               address: { type: string, example: "Hà Nội" }
 *               avatar: { type: string, example: "https://.../avatar.jpg" }
 *               username: { type: string, example: "nguyenvana" }
 *     responses:
 *       200: { description: Updated }
 */
router.put(
  "/me",
  auth,
  [
    body("fullName").optional().isLength({ min: 2, max: 100 }).withMessage("fullName 2-100 kí tự"),
    body("phoneNumber").optional({ nullable: true, checkFalsy: true })
      .matches(VN_PHONE).withMessage("Số điện thoại VN không hợp lệ"),
    body("address").optional().isLength({ max: 255 }).withMessage("address tối đa 255 kí tự"),
    body("avatar").optional().isURL().withMessage("avatar phải là URL hợp lệ"),
    body("username").optional()
      .isLength({ min: 3, max: 32 }).withMessage("username 3-32 kí tự")
      .matches(/^[a-zA-Z0-9_]+$/).withMessage("username chỉ gồm chữ, số, _")
  ],
  validate,
  updateMyProfile
);

/**
 * @openapi
 * /api/users/change-password:
 *   put:
 *     tags: [Users]
 *     summary: Đổi mật khẩu (cần oldPassword, newPassword)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string, example: "123456" }
 *               newPassword: { type: string, example: "newStrongPass1!" }
 *     responses:
 *       200: { description: Password changed }
 */
router.put(
  "/change-password",
  auth,
  [
    body("oldPassword").notEmpty().withMessage("oldPassword không được để trống"),
    body("newPassword").custom(passwordValidator),
  ],
  validate,
  changePassword
);

/**
 * @openapi
 * /api/users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload avatar cho user hiện tại
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 avatarPath: { type: string, example: "/uploads/avatars/68f...-173..jpg" }
 *                 avatarUrl:  { type: string, example: "http://localhost:4000/uploads/avatars/..." }
 */
router.post("/me/avatar", auth, uploadAvatarMulter.single("avatar"), uploadMyAvatar);

/**
 * @openapi
 * /api/users/me/avatarcloud:
 *   post:
 *     tags: [Users]
 *     summary: Upload avatar (Cloudinary)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated
 */
router.post("/me/avatarcloud", auth, uploadAvatarMem.single("avatar"), uploadMyAvatarCloud);

/* ====================================
 *  ADMIN: USER MANAGEMENT CRUD
 * ==================================== */

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Lấy danh sách tất cả users (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin, leader] }
 *     responses:
 *       200: { description: OK }
 */
router.get("/", auth, adminOnly, getAllUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Lấy chi tiết user (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get("/:id", auth, adminOnly, getUserById);

/**
 * @openapi
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Tạo user mới (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password]
 *             properties:
 *               email: { type: string, example: "user@example.com" }
 *               username: { type: string, example: "username" }
 *               password: { type: string, example: "Password@123" }
 *               fullName: { type: string, example: "Nguyen Van A" }
 *               phoneNumber: { type: string, example: "0912345678" }
 *               address: { type: string, example: "Hà Nội" }
 *               role: { type: string, enum: [user, admin, leader], default: user }
 *     responses:
 *       201: { description: User created }
 */
router.post(
  "/",
  auth,
  adminOnly,
  [
    body("email").isEmail().withMessage("Email không hợp lệ"),
    body("username").isLength({ min: 3, max: 32 }).withMessage("Username 3-32 kí tự"),
    body("password").custom(passwordValidator),
    body("fullName").optional().isLength({ min: 2, max: 100 }).withMessage("fullName 2-100 kí tự"),
    body("phoneNumber").optional({ nullable: true, checkFalsy: true }).matches(/^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/).withMessage("Số điện thoại VN không hợp lệ"),
    body("role").optional().isIn(["user", "admin", "leader"]).withMessage("Role không hợp lệ"),
  ],
  validate,
  createUserAdmin
);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Cập nhật user (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               username: { type: string }
 *               fullName: { type: string }
 *               phoneNumber: { type: string }
 *               address: { type: string }
 *               role: { type: string, enum: [user, admin, leader] }
 *     responses:
 *       200: { description: User updated }
 */
router.put(
  "/:id",
  auth,
  adminOnly,
  [
    body("email").optional().isEmail().withMessage("Email không hợp lệ"),
    body("username").optional().isLength({ min: 3, max: 32 }).withMessage("Username 3-32 kí tự"),
    body("fullName").optional().isLength({ min: 2, max: 100 }).withMessage("fullName 2-100 kí tự"),
    body("phoneNumber").optional({ nullable: true, checkFalsy: true }).matches(/^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/).withMessage("Số điện thoại VN không hợp lệ"),
    body("role").optional().isIn(["user", "admin", "leader"]).withMessage("Role không hợp lệ"),
  ],
  validate,
  updateUserAdmin
);

/**
 * @openapi
 * /api/users/{id}/reset-password:
 *   patch:
 *     tags: [Users]
 *     summary: Reset mật khẩu user (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, example: "NewPassword@123" }
 *     responses:
 *       200: { description: Password reset }
 */
router.patch(
  "/:id/reset-password",
  auth,
  adminOnly,
  [body("newPassword").custom(passwordValidator)],
  validate,
  resetUserPassword
);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Xóa user (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200: { description: User deleted }
 */
router.delete("/:id", auth, adminOnly, deleteUser);

export default router;
