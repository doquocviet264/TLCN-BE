// utils/emailTemplates.js

// 1. Hàm định dạng tiền tệ và ngày tháng
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN");
};

// 2. Khung HTML chung (Header/Footer dùng chung cho mọi mail)
const baseTemplate = (content) => `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
    <div style="background-color: #003580; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">TRAVELA</h1>
      <p style="color: #a3c2fa; margin: 5px 0 0; font-size: 14px;">Khám phá thế giới cùng bạn</p>
    </div>
    
    <div style="padding: 30px 20px; color: #333333; line-height: 1.6;">
      ${content}
    </div>

    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888;">
      <p style="margin: 0;">Cảm ơn bạn đã tin tưởng Travela.</p>
      <p style="margin: 5px 0;">Hotline: 1900 1234 | Email: support@travela.com</p>
      <p style="margin-top: 10px;">&copy; 2024 Travela Inc. All rights reserved.</p>
    </div>
  </div>
`;

// --- CÁC MẪU EMAIL CỤ THỂ ---

// 1. Đăng ký tài khoản
export const getWelcomeTemplate = (fullName) => {
  return baseTemplate(`
    <h2 style="color: #003580;">Xin chào ${fullName},</h2>
    <p>Chào mừng bạn gia nhập cộng đồng <b>Travela</b>! Tài khoản của bạn đã được khởi tạo thành công.</p>
    <p>Hãy bắt đầu hành trình khám phá những vùng đất mới ngay hôm nay.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.CLIENT_URL}/login" style="background-color: #003580; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đăng nhập ngay</a>
    </div>
  `);
};

// 2. Quên mật khẩu
export const getResetPasswordTemplate = (newPass) => {
  return baseTemplate(`
    <h2 style="color: #d9534f;">Yêu cầu cấp lại mật khẩu</h2>
    <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu từ bạn.</p>
    <p>Mật khẩu mới của bạn là:</p>
    <div style="background-color: #fce4e4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; border-radius: 5px; color: #d9534f; margin: 20px 0;">
      ${newPass}
    </div>
    <p><i>Vui lòng đăng nhập và đổi lại mật khẩu ngay lập tức để bảo mật tài khoản.</i></p>
  `);
};

// 3. Đặt tour thành công (Chờ thanh toán)
export const getBookingCreatedTemplate = (booking, tour) => {
  return baseTemplate(`
    <h2 style="color: #28a745;">✅ Đặt tour thành công!</h2>
    <p>Xin chào <b>${booking.fullName}</b>,</p>
    <p>Đơn đặt tour <b>#${booking.code}</b> của bạn đã được ghi nhận.</p>
    
    <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #003580;">${tour.title}</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr><td style="padding: 5px 0;">📅 Ngày đi:</td><td><b>${formatDate(
          tour.startDate
        )}</b></td></tr>
        <tr><td style="padding: 5px 0;">👥 Số khách:</td><td>${
          booking.numAdults
        } Lớn, ${booking.numChildren} Bé</td></tr>
        <tr><td style="padding: 5px 0;">💰 Tổng tiền:</td><td style="font-weight:bold; color:#d9534f;">${formatCurrency(
          booking.totalPrice
        )}</td></tr>
        <tr><td style="padding: 5px 0;">💳 Cần cọc:</td><td><b>${formatCurrency(
          booking.depositAmount
        )}</b></td></tr>
      </table>
    </div>
    <p>Vui lòng thanh toán tiền cọc để chúng tôi giữ chỗ cho bạn.</p>
  `);
};

// 4. Thông báo thanh toán
export const getPaymentReceiptTemplate = (booking, amountPaid) => {
  const isFullPaid = booking.paidAmount >= booking.totalPrice;
  const status = isFullPaid ? "ĐÃ THANH TOÁN ĐỦ" : "ĐÃ ĐẶT CỌC";
  const color = isFullPaid ? "#28a745" : "#ffc107";

  return baseTemplate(`
    <h2>💸 Xác nhận thanh toán</h2>
    <p>Travela đã nhận được khoản thanh toán cho đơn hàng <b>#${
      booking.code
    }</b>.</p>
    
    <div style="border: 2px dashed ${color}; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;">Số tiền vừa thanh toán</p>
      <h1 style="margin: 5px 0; color: ${color};">${formatCurrency(
    amountPaid
  )}</h1>
      <p style="margin: 10px 0 0; font-weight: bold; text-transform: uppercase;">TRẠNG THÁI: ${status}</p>
    </div>

    <p>Tổng đã trả: <b>${formatCurrency(
      booking.paidAmount
    )}</b> / ${formatCurrency(booking.totalPrice)}</p>
    ${
      !isFullPaid
        ? `<p style="color: #d9534f;">Số tiền còn lại cần thanh toán: <b>${formatCurrency(
            booking.totalPrice - booking.paidAmount
          )}</b></p>`
        : ""
    }
  `);
};

// 5. Xác nhận Tour & Lịch trình
export const getTourConfirmedTemplate = (booking, tour) => {
  // Render lịch trình tour (nếu có)
  const itineraryHtml =
    tour.itinerary && tour.itinerary.length > 0
      ? tour.itinerary
          .map(
            (day) => `
        <div style="margin-bottom: 15px; border-left: 3px solid #003580; padding-left: 15px;">
          <strong style="color: #003580;">Ngày ${day.day}:</strong>
          <p style="margin: 5px 0;">${day.activities}</p>
        </div>
      `
          )
          .join("")
      : "<p>Lịch trình chi tiết sẽ được Hướng dẫn viên phổ biến khi gặp mặt.</p>";

  return baseTemplate(`
    <h2 style="text-align: center; color: #003580;">🎉 TOUR ĐÃ ĐƯỢC XÁC NHẬN!</h2>
    <p>Xin chào <b>${booking.fullName}</b>,</p>
    <p>Tin vui! Chuyến đi <b>${
      tour.title
    }</b> của bạn đã chính thức được xác nhận khởi hành.</p>
    
    <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Thông tin tập trung</h3>
      <p>📍 <b>Điểm hẹn:</b> ${tour.destination || "Văn phòng Travela"}</p>
      <p>⏰ <b>Thời gian:</b> ${tour.time || "07:00 AM"}, ngày ${formatDate(
    tour.startDate
  )}</p>
      <p>📞 <b>Liên hệ HDV:</b> Sẽ cập nhật trước 1 ngày</p>
    </div>

    <h3>🗺️ Lịch trình tóm tắt:</h3>
    ${itineraryHtml}

    <p>Chúc bạn có một chuyến đi thượng lộ bình an và nhiều kỷ niệm đẹp!</p>
  `);
};
export const getOtpTemplate = (otp) => {
  return baseTemplate(`
    <h2 style="color: #003580;">Mã xác thực tài khoản</h2>
    <p>Cảm ơn bạn đã đăng ký Travela. Vui lòng nhập mã OTP dưới đây để kích hoạt tài khoản:</p>
    
    <div style="background-color: #f0f4f8; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #003580; border-radius: 8px; margin: 20px 0;">
      ${otp}
    </div>
    
    <p>Mã này sẽ hết hạn trong vòng <b>5 phút</b>.</p>
    <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
  `);
};
