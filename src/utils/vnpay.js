// src/utils/vnpay.js
// Viết lại theo đúng code mẫu chính thức vnpay_nodejs (routes/order.js)
import crypto from "crypto";
import qs from "qs";

/**
 * SortObject — chính xác theo code mẫu vnpay_nodejs
 * Encode key & value bằng encodeURIComponent, replace %20 → "+"
 */
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

/**
 * Format date theo chuẩn VNPay: YYYYMMDDHHmmss (timezone Asia/Ho_Chi_Minh)
 */
function formatDateVNPay(date = new Date()) {
  // Đảm bảo timezone Việt Nam
  const vnDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    vnDate.getFullYear().toString() +
    pad(vnDate.getMonth() + 1) +
    pad(vnDate.getDate()) +
    pad(vnDate.getHours()) +
    pad(vnDate.getMinutes()) +
    pad(vnDate.getSeconds())
  );
}

/**
 * Build URL thanh toán VNPay — theo đúng code mẫu chính thức
 *
 * @param {Object} params
 * @param {string} params.tmnCode     - Mã website (vnp_TmnCode)
 * @param {string} params.hashSecret  - Chuỗi bí mật (vnp_HashSecret)
 * @param {string} params.vnpUrl      - URL thanh toán sandbox/production
 * @param {string} params.returnUrl   - URL nhận kết quả (vnp_ReturnUrl)
 * @param {number} params.amountVND   - Số tiền VNĐ (chưa nhân 100)
 * @param {string} params.orderInfo   - Thông tin đơn hàng (không dấu, không ký tự đặc biệt)
 * @param {string} params.txnRef      - Mã tham chiếu giao dịch (duy nhất trong ngày)
 * @param {string} params.ipAddr      - IP khách hàng
 * @param {string} [params.locale]    - Ngôn ngữ: vn | en
 * @param {string} [params.bankCode]  - Mã ngân hàng (tùy chọn)
 * @param {string} [params.orderType] - Mã danh mục hàng hóa
 */
export function buildVNPayPayUrl({
  tmnCode,
  hashSecret,
  vnpUrl,
  returnUrl,
  amountVND,
  orderInfo,
  txnRef,
  ipAddr,
  locale = "vn",
  bankCode = "",
  orderType = "other",
}) {
  process.env.TZ = "Asia/Ho_Chi_Minh";

  const date = new Date();
  const createDate = formatDateVNPay(date);

  // vnp_ExpireDate: +24h (bắt buộc theo tài liệu)
  const expireDate = formatDateVNPay(
    new Date(date.getTime() + 24 * 60 * 60 * 1000)
  );

  // BẮT BUỘC: amount * 100 để triệt tiêu phần thập phân
  const vnpAmount = Math.round(Number(amountVND || 0)) * 100;

  let vnp_Params = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = txnRef;
  vnp_Params["vnp_OrderInfo"] = orderInfo;
  vnp_Params["vnp_OrderType"] = orderType;
  vnp_Params["vnp_Amount"] = vnpAmount;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;
  vnp_Params["vnp_ExpireDate"] = expireDate;

  if (bankCode !== null && bankCode !== "") {
    vnp_Params["vnp_BankCode"] = bankCode;
  }

  // Sort theo đúng code mẫu (encode key + value trước khi sort)
  vnp_Params = sortObject(vnp_Params);

  // Tạo signData: qs.stringify với encode: false (vì sortObject đã encode)
  const signData = qs.stringify(vnp_Params, { encode: false });

  // Ký HMAC SHA512
  const hmac = crypto.createHmac("sha512", hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  vnp_Params["vnp_SecureHash"] = signed;

  // Build URL cuối cùng
  const paymentUrl =
    vnpUrl + "?" + qs.stringify(vnp_Params, { encode: false });

  return paymentUrl;
}

/**
 * Verify checksum từ VNPay IPN / Return — theo đúng code mẫu chính thức
 *
 * @param {Object} query   - req.query từ VNPay callback
 * @param {string} hashSecret - Chuỗi bí mật
 * @returns {{ ok: boolean, signed: string, secureHash: string }}
 */
export function verifyVNPayChecksum(query, hashSecret) {
  // Copy query để không sửa object gốc
  let vnp_Params = { ...query };

  const secureHash = vnp_Params["vnp_SecureHash"];

  // Xóa hash ra khỏi params trước khi verify (giống code mẫu)
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  // Sort theo đúng code mẫu
  vnp_Params = sortObject(vnp_Params);

  const signData = qs.stringify(vnp_Params, { encode: false });

  const hmac = crypto.createHmac("sha512", hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return {
    ok: secureHash === signed,
    signed,
    secureHash,
  };
}
