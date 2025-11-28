import { Router } from "express";
import { leaderLogin, LeaderLogout } from "../controllers/leader.auth.controller.js";

const router = Router();

/**
 * @openapi
 * /api/leader/login:
 *   post:
 *     tags: [Leader]
 *     summary: Leader đăng nhập (JWT role=leader)
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
 *                 example: leader1 or leader1@example.com
 *               password:
 *                 type: string
 *                 example: Abc@1234
 *     responses:
 *       200:
 *         description: Login success
 */
router.post("/login", leaderLogin);

// Đăng xuất
/**
 * @openapi
 * /api/leader/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Leader]
 *     responses:
 *       200:
 *         description: Logout success
 */
router.post("/logout", LeaderLogout);
export default router;
