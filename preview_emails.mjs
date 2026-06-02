// preview_emails.mjs — Run: node preview_emails.mjs
import { writeFileSync } from "fs";
import {
  getOtpTemplate,
  getWelcomeTemplate,
  getResetPasswordTemplate,
  getBookingCreatedTemplate,
  getPaymentReceiptTemplate,
  getTourConfirmedTemplate,
} from "./src/utils/emailTemplates.js";

// Mock data
const mockBooking = {
  fullName: "Nguyễn Văn An",
  code: "TOUR-2024-001",
  numAdults: 2,
  numChildren: 1,
  totalPrice: 8500000,
  depositAmount: 2550000,
  paidAmount: 2550000,
  email: "test@gmail.com",
};

const mockTour = {
  title: "Hành trình Đà Nẵng – Hội An 4N3D",
  startDate: new Date("2024-12-25"),
  destination: "Sân bay Tân Sơn Nhất, cổng D",
  time: "06:30 AM",
  itinerary: [
    { day: 1, activities: "Đón khách tại sân bay, check-in khách sạn, tham quan phố cổ Hội An về đêm." },
    { day: 2, activities: "Tham quan Ngũ Hành Sơn, Bà Nà Hills, cáp treo Golden Bridge." },
    { day: 3, activities: "Tự do tham quan, mua sắm tại chợ Hàn và Bờ Kè sông Hàn." },
    { day: 4, activities: "Tiễn khách tại sân bay Đà Nẵng." },
  ],
};

const mockBookingFullPaid = { ...mockBooking, paidAmount: 8500000 };

// Generate all templates
const templates = [
  { title: "1. OTP Verification", html: getOtpTemplate("847291") },
  { title: "2. Welcome Email", html: getWelcomeTemplate("Nguyễn Văn An") },
  {
    title: "3. Reset Password",
    html: getResetPasswordTemplate(
      "Mật khẩu của bạn đã được đặt lại thành công. Nếu bạn không thực hiện hành động này, vui lòng liên hệ hỗ trợ ngay."
    ),
  },
  { title: "4. Booking Created", html: getBookingCreatedTemplate(mockBooking, mockTour) },
  { title: "5. Payment Receipt (Đã cọc)", html: getPaymentReceiptTemplate(mockBooking, 2550000) },
  { title: "6. Payment Receipt (Hoàn tất)", html: getPaymentReceiptTemplate(mockBookingFullPaid, 5950000) },
  { title: "7. Tour Confirmed", html: getTourConfirmedTemplate(mockBooking, mockTour) },
];

const page = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>AHH Travel — Email Templates Preview</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #dde2ea; padding: 24px; margin: 0; }
    h1 { color: #1D3B72; font-size: 22px; margin: 0 0 8px; }
    .subtitle { color: #828282; font-size: 14px; margin: 0 0 32px; }
    .section { margin-bottom: 48px; }
    .section-label { font-size: 13px; font-weight: 700; color: #307afd; text-transform: uppercase;
                     letter-spacing: 1px; margin-bottom: 12px; padding: 6px 14px;
                     background: #EEF4FF; display: inline-block; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>AHH Travel — Email Templates Preview</h1>
  <p class="subtitle">Preview toàn bộ email templates đang được sử dụng trong hệ thống</p>
  ${templates.map((t) => `
  <div class="section">
    <div class="section-label">${t.title}</div>
    ${t.html}
  </div>`).join("")}
</body>
</html>`;

writeFileSync("email_preview.html", page, "utf-8");
console.log("✓ Preview created: email_preview.html");
