import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import { sendMail } from "../services/mailer.js";
import { rateLimit } from "express-rate-limit";

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: "Bạn đã gửi quá nhiều tin nhắn, vui lòng thử lại sau." },
});

const contactValidation = [
  body("name").trim().notEmpty().withMessage("Họ tên không được để trống"),
  body("phone").trim().notEmpty().withMessage("Số điện thoại không được để trống"),
  body("email").isEmail().withMessage("Email không hợp lệ").normalizeEmail(),
  body("message").trim().notEmpty().withMessage("Nội dung không được để trống"),
];

router.post("/", contactLimiter, contactValidation, validate, async (req, res) => {
  const { name, phone, email, subject, message } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_FROM || "noreply@resend.dev";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
      <div style="background:#0f2d5e;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:20px;">📩 Liên hệ mới từ website</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;width:130px;font-size:14px;font-weight:600;">Họ tên:</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;font-weight:600;">Điện thoại:</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;">${phone}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;font-weight:600;">Email:</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:14px;font-weight:600;">Chủ đề:</td>
              <td style="padding:8px 0;color:#1e293b;font-size:14px;">${subject || "(Không có)"}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <p style="color:#64748b;font-size:14px;font-weight:600;margin:0 0 8px;">Nội dung:</p>
        <p style="color:#1e293b;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">Gửi lúc: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
      </div>
    </div>
  `;

  try {
    await sendMail({
      to: adminEmail,
      subject: `[AHH Travel] Liên hệ mới từ ${name}${subject ? ` — ${subject}` : ""}`,
      html,
    });
    res.json({ message: "Gửi thành công" });
  } catch (err) {
    console.error("Contact mail error:", err);
    res.status(500).json({ message: "Không thể gửi tin nhắn, vui lòng thử lại sau." });
  }
});

export default router;
