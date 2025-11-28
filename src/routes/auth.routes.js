import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  login,
  logout,
  resetPassword,
  getProfile
} from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";
import passport from "../config/passport.js";  
import jwt from "jsonwebtoken";
import { validate } from "../middleware/validate.js";
import { passwordValidator } from "../utils/passwordValidator.js";

const router = Router();

const VN_PHONE = /^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/;

// Đăng ký
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               fullName: { type: string, example: "Nguyen Van A" }
 *               username: { type: string, example: "nguyenvana" }
 *               email: { type: string, example: "a@example.com" }
 *               password: { type: string, example: "123456" }
 *               phoneNumber: { type: string, example: "0912345678" }
 *     responses:
 *       201: { description: Registered }
 */
router.post(
  "/register",
  [
    body("fullName").optional().isLength({ min: 2, max: 100 }).withMessage("Họ tên phải từ 2-100 ký tự"),
    body("username")
      .trim()
      .notEmpty().withMessage("Username không được để trống")
      .isLength({ min: 3, max: 32 }).withMessage("Username phải từ 3-32 ký tự")
      .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username chỉ gồm chữ, số, dấu gạch dưới"),
    body("email").isEmail().withMessage("Email không hợp lệ").normalizeEmail(),
    body("password").custom(passwordValidator),
    body("phoneNumber")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/).withMessage("Số điện thoại VN không hợp lệ"),
  ],
  validate,
  register
);


// Đăng nhập
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập bằng username hoặc email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: "nguyenvana"   # hoặc "a@example.com"
 *               password:
 *                 type: string
 *                 example: "Abc@1234"
 *     responses:
 *       200: { description: Login success }
 */
router.post(
  "/login",
  [
    body("identifier").trim().notEmpty().withMessage("identifier bắt buộc"),
    body("password").notEmpty().withMessage("password bắt buộc").custom(passwordValidator)
  ],
  validate,
  login
);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Đăng nhập thành công → cấp JWT hoặc set cookie
    const token = jwt.sign(
      { id: req.user.userId, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.json({ message: "Login with Google success", token, user: req.user });
  }
);

// Đăng xuất
/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout success
 */
router.post("/logout", logout);

// Quên mật khẩu
/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Quên mật khẩu (gửi mật khẩu mới qua email)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: New password sent
 */
router.post(
  "/forgot-password",
  [ body("email").isEmail().withMessage("email không hợp lệ").normalizeEmail() ],
  validate,
  resetPassword
);

// Lấy thông tin người dùng hiện tại (test middleware)
/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 points:
 *                   type: number
 *                 memberStatus:
 *                   type: string
 */
router.get("/me", getProfile);

export default router;
