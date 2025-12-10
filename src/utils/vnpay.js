// src/utils/vnpay.js
import crypto from "crypto";
import qs from "qs";

/**
 * Format date theo chuẩn VNPay: yyyyMMddHHmmss
 */
function formatDateVNPay(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/**
 * Sắp xếp key theo alphabet (yêu cầu của VNPay)
 */
function sortObject(obj = {}) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      sorted[k] = obj[k];
    });
  return sorted;
}

/**
 * Build URL thanh toán VNPay
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
  orderType = "other",
}) {
  // BẮT BUỘC: amount * 100 và là integer
  const vnpAmount = Math.round(Number(amountVND || 0)) * 100;

  let vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: vnpAmount,
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: orderType,
    vnp_Locale: locale,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: formatDateVNPay(),
    vnp_SecureHashType: "HMACSHA512", // dùng với HMAC SHA512
  };

  // Sắp xếp
  vnp_Params = sortObject(vnp_Params);

  // Chuỗi để ký: không encode
  const signData = qs.stringify(vnp_Params, { encode: false });

  // Tạo chữ ký HMAC SHA512
  const hmac = crypto.createHmac("sha512", hashSecret);
  const signature = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  vnp_Params.vnp_SecureHash = signature;

  // Build URL trả về cho FE
  const paymentUrl = vnpUrl + "?" + qs.stringify(vnp_Params, { encode: true });
  return paymentUrl;
}

/**
 * Verify checksum từ VNPay IPN / Return
 */
export function verifyVNPayChecksum(query, hashSecret) {
  // Không sửa trực tiếp object gốc
  const params = { ...query };

  const secureHash = params.vnp_SecureHash;
  // Có thể có hoặc không, cứ xóa cho chắc
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false });

  const signed = crypto
    .createHmac("sha512", hashSecret)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  return {
    ok: secureHash === signed,
    signed,
    secureHash,
  };
}
