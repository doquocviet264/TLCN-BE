/**
 * Rate Limiter Middleware
 * Giới hạn số lượng request để chống brute force và spam
 */

// Lưu trữ request counts trong memory (cho môi trường dev/small scale)
// Production nên dùng Redis
const requestCounts = new Map();

// Dọn dẹp entries cũ mỗi phút
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.firstRequest > data.windowMs) {
      requestCounts.delete(key);
    }
  }
}, 60000);

/**
 * Tạo rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Thời gian cửa sổ (ms)
 * @param {number} options.max - Số request tối đa trong cửa sổ
 * @param {string} options.message - Thông báo khi bị rate limit
 * @param {string} options.keyPrefix - Tiền tố cho key (phân biệt các loại limit)
 */
export const createRateLimiter = (options) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 phút mặc định
    max = 100,
    message = "Quá nhiều yêu cầu, vui lòng thử lại sau.",
    keyPrefix = "rl",
  } = options;

  return (req, res, next) => {
    // Tạo key từ IP + prefix
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;

    const now = Date.now();
    const data = requestCounts.get(key);

    if (!data) {
      // Request đầu tiên
      requestCounts.set(key, {
        count: 1,
        firstRequest: now,
        windowMs,
      });
      return next();
    }

    // Kiểm tra xem đã qua cửa sổ thời gian chưa
    if (now - data.firstRequest > windowMs) {
      // Reset counter
      requestCounts.set(key, {
        count: 1,
        firstRequest: now,
        windowMs,
      });
      return next();
    }

    // Tăng counter
    data.count++;

    if (data.count > max) {
      const retryAfter = Math.ceil((data.firstRequest + windowMs - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        message,
        retryAfter,
      });
    }

    next();
  };
};

// ============================================================
// CÁC RATE LIMITER CỤ THỂ
// ============================================================

// Rate limiter cho đăng nhập: 5 lần / 15 phút / IP
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tăng lên 10 vì đã có account lockout
  message: "Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.",
  keyPrefix: "login",
});

// Rate limiter cho đăng ký: 3 lần / 1 giờ / IP
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5,
  message: "Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ.",
  keyPrefix: "register",
});

// Rate limiter cho gửi OTP: 5 lần / 15 phút / IP
export const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5,
  message: "Quá nhiều lần gửi OTP. Vui lòng thử lại sau 15 phút.",
  keyPrefix: "otp",
});

// Rate limiter cho quên mật khẩu: 3 lần / 1 giờ / IP
export const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3,
  message: "Quá nhiều lần yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ.",
  keyPrefix: "forgot",
});

// Rate limiter chung cho API: 100 request / phút / IP
export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: 100,
  message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
  keyPrefix: "general",
});
