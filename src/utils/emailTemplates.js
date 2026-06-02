// utils/emailTemplates.js

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// ─── Base Template ─────────────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1D3B72 0%,#307afd 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:3px;text-transform:uppercase;">AHH</p>
              <p style="margin:0;font-size:13px;font-weight:600;color:#F15A24;letter-spacing:6px;text-transform:uppercase;">TRAVEL</p>
              <div style="width:40px;height:2px;background-color:rgba(255,255,255,0.3);margin:16px auto 0;border-radius:2px;"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 32px;color:#1d1d1d;line-height:1.7;font-size:15px;">
              ${content}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#e8eaf0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f8fb;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1D3B72;letter-spacing:1px;">AHH TRAVEL</p>
              <p style="margin:0 0 4px;font-size:12px;color:#828282;">Số 1 Võ Văn Ngân, Linh Chiểu, Thủ Đức, TP. HCM</p>
              <p style="margin:0 0 12px;font-size:12px;color:#828282;">
                Hotline: (+84) 123 456 789 &nbsp;|&nbsp; Email: admin@ahhtravel.com
              </p>
              <p style="margin:0;font-size:11px;color:#bdbdbd;">&copy; ${new Date().getFullYear()} AHH Travel. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── 1. OTP Verification ───────────────────────────────────────────────────────
export const getOtpTemplate = (otp) =>
  baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1D3B72;">Mã xác thực tài khoản</h2>
    <p style="margin:0 0 24px;color:#4f4f4f;">
      Cảm ơn bạn đã sử dụng dịch vụ của <strong>AHH Travel</strong>.
      Vui lòng nhập mã dưới đây để tiếp tục. Mã có hiệu lực trong <strong>5 phút</strong>.
    </p>

    <!-- OTP Box -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:0 0 28px;">
          <div style="display:inline-block;background-color:#EEF4FF;border:1.5px solid #c7d9ff;border-radius:12px;padding:24px 48px;">
            <p style="margin:0 0 6px;font-size:12px;color:#828282;letter-spacing:1px;text-transform:uppercase;">Mã xác thực</p>
            <p style="margin:0;font-size:36px;font-weight:800;color:#307afd;letter-spacing:10px;">${otp}</p>
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color:#fff8f0;border-left:3px solid #F15A24;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:8px;">
      <p style="margin:0;font-size:13px;color:#4f4f4f;">
        Vì lý do bảo mật, vui lòng <strong>không chia sẻ mã này</strong> với bất kỳ ai, kể cả nhân viên AHH Travel.
      </p>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#828282;">
      Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email. Tài khoản của bạn vẫn được bảo mật.
    </p>
  `);

// ─── 2. Welcome ────────────────────────────────────────────────────────────────
export const getWelcomeTemplate = (fullName) =>
  baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1D3B72;">Chào mừng, ${fullName}!</h2>
    <p style="margin:0 0 24px;color:#4f4f4f;">
      Tài khoản <strong>AHH Travel</strong> của bạn đã được xác thực thành công.
      Chúng tôi rất vui được đồng hành cùng bạn trên những chuyến hành trình khám phá Việt Nam.
    </p>

    <!-- Features -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:12px 16px;background-color:#f7f8fb;border-radius:8px 8px 0 0;border-bottom:1px solid #e8eaf0;">
          <p style="margin:0;font-size:14px;color:#1d1d1d;"><strong style="color:#307afd;">Khám phá Tours</strong> &mdash; Hàng trăm tour du lịch được thiết kế riêng cho bạn</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f7f8fb;border-bottom:1px solid #e8eaf0;">
          <p style="margin:0;font-size:14px;color:#1d1d1d;"><strong style="color:#307afd;">Đặt tour dễ dàng</strong> &mdash; Thanh toán linh hoạt với nhiều hình thức</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f7f8fb;border-radius:0 0 8px 8px;">
          <p style="margin:0;font-size:14px;color:#1d1d1d;"><strong style="color:#307afd;">Chia sẻ hành trình</strong> &mdash; Viết blog và lưu lại kỷ niệm cùng cộng đồng</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${process.env.CLIENT_URL || "https://ahhtravel.com"}"
             style="display:inline-block;background-color:#307afd;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
            Khám phá ngay
          </a>
        </td>
      </tr>
    </table>
  `);

// ─── 3. Reset Password ─────────────────────────────────────────────────────────
export const getResetPasswordTemplate = (message) =>
  baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1D3B72;">Mật khẩu đã được đặt lại</h2>
    <p style="margin:0 0 24px;color:#4f4f4f;">
      Yêu cầu đặt lại mật khẩu tài khoản <strong>AHH Travel</strong> của bạn đã được xử lý thành công.
    </p>

    <div style="background-color:#f0faf4;border:1.5px solid #b7e4c7;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#27ae60;font-weight:600;">Thay đổi mật khẩu thành công</p>
      <p style="margin:8px 0 0;font-size:14px;color:#4f4f4f;">${message}</p>
    </div>

    <div style="background-color:#fff8f0;border-left:3px solid #F15A24;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#4f4f4f;">
        Nếu bạn không thực hiện hành động này, vui lòng liên hệ ngay với chúng tôi qua
        <strong>admin@ahhtravel.com</strong> hoặc hotline <strong>(+84) 123 456 789</strong>.
      </p>
    </div>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${process.env.CLIENT_URL || "https://ahhtravel.com"}/auth/login"
             style="display:inline-block;background-color:#307afd;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;">
            Đăng nhập
          </a>
        </td>
      </tr>
    </table>
  `);

// ─── 4. Booking Created ────────────────────────────────────────────────────────
export const getBookingCreatedTemplate = (booking, tour) =>
  baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1D3B72;">Đặt tour thành công</h2>
    <p style="margin:0 0 24px;color:#4f4f4f;">
      Xin chào <strong>${booking.fullName}</strong>, đơn đặt tour <strong>#${booking.code}</strong> của bạn
      đã được ghi nhận. Vui lòng hoàn tất thanh toán cọc để giữ chỗ.
    </p>

    <!-- Tour Info Card -->
    <div style="border:1.5px solid #e8eaf0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <div style="background-color:#1D3B72;padding:14px 20px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${tour.title}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr style="border-bottom:1px solid #f0f2f5;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;width:50%;">Ngày khởi hành</td>
          <td style="padding:12px 20px;font-size:14px;color:#1d1d1d;font-weight:600;">${formatDate(tour.startDate)}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f2f5;background-color:#fafafa;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Số khách</td>
          <td style="padding:12px 20px;font-size:14px;color:#1d1d1d;">${booking.numAdults} người lớn, ${booking.numChildren} trẻ em</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f2f5;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Tổng giá trị</td>
          <td style="padding:12px 20px;font-size:15px;color:#307afd;font-weight:700;">${formatCurrency(booking.totalPrice)}</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Tiền cọc cần thanh toán</td>
          <td style="padding:12px 20px;font-size:15px;color:#F15A24;font-weight:700;">${formatCurrency(booking.depositAmount)}</td>
        </tr>
      </table>
    </div>

    <!-- Status Badge -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background-color:#fff8f0;border:1.5px solid #F15A24;border-radius:20px;padding:6px 20px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#F15A24;letter-spacing:1px;text-transform:uppercase;">Chờ thanh toán cọc</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${process.env.CLIENT_URL || "https://ahhtravel.com"}/user/history"
             style="display:inline-block;background-color:#307afd;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;">
            Thanh toán cọc ngay
          </a>
        </td>
      </tr>
    </table>
  `);

// ─── 5. Payment Receipt ────────────────────────────────────────────────────────
export const getPaymentReceiptTemplate = (booking, amountPaid) => {
  const isFullPaid = booking.paidAmount >= booking.totalPrice;
  const remaining = Math.max(0, booking.totalPrice - booking.paidAmount);
  const progressPct = Math.min(100, Math.round((booking.paidAmount / booking.totalPrice) * 100));

  const statusLabel = isFullPaid ? "Thanh toán hoàn tất" : "Đã đặt cọc";
  const statusBg    = isFullPaid ? "#f0faf4" : "#fff8f0";
  const statusBorder = isFullPaid ? "#b7e4c7" : "#ffd699";
  const statusColor = isFullPaid ? "#27ae60" : "#f2b93b";

  return baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1D3B72;">Xác nhận thanh toán</h2>
    <p style="margin:0 0 24px;color:#4f4f4f;">
      AHH Travel đã nhận được khoản thanh toán cho đơn hàng <strong>#${booking.code}</strong>.
    </p>

    <!-- Amount Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <div style="border:1.5px solid #e8eaf0;border-radius:10px;padding:24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#828282;text-transform:uppercase;letter-spacing:1px;">Số tiền vừa thanh toán</p>
            <p style="margin:0 0 16px;font-size:34px;font-weight:800;color:#307afd;">${formatCurrency(amountPaid)}</p>
            <div style="display:inline-block;background-color:${statusBg};border:1.5px solid ${statusBorder};border-radius:20px;padding:5px 18px;">
              <p style="margin:0;font-size:12px;font-weight:700;color:${statusColor};letter-spacing:1px;text-transform:uppercase;">${statusLabel}</p>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Payment Summary -->
    <div style="border:1.5px solid #e8eaf0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr style="border-bottom:1px solid #f0f2f5;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Tổng giá trị đơn</td>
          <td style="padding:12px 20px;font-size:14px;color:#1d1d1d;font-weight:600;text-align:right;">${formatCurrency(booking.totalPrice)}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f2f5;background-color:#fafafa;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Đã thanh toán</td>
          <td style="padding:12px 20px;font-size:14px;color:#27ae60;font-weight:600;text-align:right;">${formatCurrency(booking.paidAmount)}</td>
        </tr>
        ${!isFullPaid ? `
        <tr>
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Còn lại</td>
          <td style="padding:12px 20px;font-size:14px;color:#F15A24;font-weight:700;text-align:right;">${formatCurrency(remaining)}</td>
        </tr>` : ""}
      </table>
    </div>

    <!-- Progress Bar -->
    <p style="margin:0 0 6px;font-size:12px;color:#828282;">Tiến độ thanh toán &mdash; ${progressPct}%</p>
    <div style="background-color:#e8eaf0;border-radius:6px;height:8px;overflow:hidden;margin-bottom:24px;">
      <div style="background:linear-gradient(90deg,#307afd,#1D3B72);height:8px;width:${progressPct}%;border-radius:6px;"></div>
    </div>

    ${!isFullPaid ? `
    <div style="background-color:#fff8f0;border-left:3px solid #F15A24;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:8px;">
      <p style="margin:0;font-size:13px;color:#4f4f4f;">
        Vui lòng hoàn tất phần còn lại trước ngày khởi hành để chuyến đi diễn ra thuận lợi.
      </p>
    </div>` : `
    <div style="background-color:#f0faf4;border-left:3px solid #27ae60;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:8px;">
      <p style="margin:0;font-size:13px;color:#27ae60;font-weight:600;">
        Bạn đã hoàn tất thanh toán. Chúc bạn có một chuyến đi tuyệt vời!
      </p>
    </div>`}
  `);
};

// ─── 6. Tour Confirmed ─────────────────────────────────────────────────────────
export const getTourConfirmedTemplate = (booking, tour) => {
  const itineraryRows =
    tour.itinerary && tour.itinerary.length > 0
      ? tour.itinerary
          .map(
            (day, idx) => `
          <tr style="${idx % 2 === 0 ? "" : "background-color:#fafafa;"}">
            <td style="padding:12px 20px;font-size:14px;font-weight:700;color:#307afd;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0f2f5;">Ngày ${day.day}</td>
            <td style="padding:12px 20px;font-size:14px;color:#4f4f4f;border-bottom:1px solid #f0f2f5;">${day.activities}</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="2" style="padding:16px 20px;font-size:14px;color:#828282;font-style:italic;">Lịch trình chi tiết sẽ được hướng dẫn viên phổ biến khi gặp mặt.</td></tr>`;

  return baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1D3B72;">Tour đã được xác nhận khởi hành</h2>
    <p style="margin:0 0 24px;color:#4f4f4f;">
      Xin chào <strong>${booking.fullName}</strong>, chuyến đi <strong>${tour.title}</strong>
      đã chính thức xác nhận khởi hành. Chúng tôi rất vui được đồng hành cùng bạn!
    </p>

    <!-- Meeting Info -->
    <div style="border:1.5px solid #e8eaf0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <div style="background-color:#1D3B72;padding:12px 20px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">Thông tin tập trung</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr style="border-bottom:1px solid #f0f2f5;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;width:40%;">Điểm hẹn</td>
          <td style="padding:12px 20px;font-size:14px;color:#1d1d1d;font-weight:600;">${tour.destination || "Văn phòng AHH Travel"}</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Thời gian</td>
          <td style="padding:12px 20px;font-size:14px;color:#1d1d1d;font-weight:600;">${tour.time || "07:00 AM"}, ngày ${formatDate(tour.startDate)}</td>
        </tr>
        <tr>
          <td style="padding:12px 20px;font-size:14px;color:#828282;">Liên hệ HDV</td>
          <td style="padding:12px 20px;font-size:14px;color:#4f4f4f;font-style:italic;">Sẽ cập nhật trước 1 ngày khởi hành</td>
        </tr>
      </table>
    </div>

    <!-- Itinerary -->
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1D3B72;text-transform:uppercase;letter-spacing:0.5px;">Lịch trình tóm tắt</p>
    <div style="border:1.5px solid #e8eaf0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${itineraryRows}
      </table>
    </div>

    <p style="margin:0;font-size:14px;color:#4f4f4f;">
      Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ chúng tôi qua
      <strong>admin@ahhtravel.com</strong> hoặc hotline <strong>(+84) 123 456 789</strong>.
    </p>
  `);
};
