import crypto from "crypto";

// Chuẩn hoá encode theo yêu cầu VNPAY (space => +)
function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/%20/g, "+").replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16));
}

// Tạo chuỗi ký (sort theo key, encode value)
function buildSignedQuery(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map(k => `${k}=${encodeRFC3986(params[k])}`).join("&");
  const hmac = crypto.createHmac("sha512", secret);
  const secureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  return { signData, secureHash };
}

export function buildVNPayPayUrl({
  vnpUrl,
  tmnCode,
  hashSecret,
  amountVND,
  orderInfo,
  txnRef,        // booking.code hoặc code kèm timestamp
  ipAddr,
  returnUrl,
  locale = "vn",
  currCode = "VND",
  bankCode      // optional
}) {
  const vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amountVND * 100),      // nhân 100
    vnp_CurrCode: currCode,
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_Locale: locale,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0,14), // yyyyMMddHHmmss
  };
  if (bankCode) vnp_Params.vnp_BankCode = bankCode;

  // Ký
  const { secureHash } = buildSignedQuery(vnp_Params, hashSecret);
  vnp_Params.vnp_SecureHashType = "HMACSHA512";
  vnp_Params.vnp_SecureHash = secureHash;

  // Build URL
  const queryStr = Object.keys(vnp_Params)
    .sort()
    .map(k => `${k}=${encodeRFC3986(vnp_Params[k])}`)
    .join("&");

  return `${vnpUrl}?${queryStr}`;
}

// Xác minh chữ ký trả về từ VNPAY (return/IPN)
export function verifyVNPayChecksum(query, hashSecret) {
  const params = { ...query };
  const secureHash = params.vnp_SecureHash;
  const secureHashType = params.vnp_SecureHashType;
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`).join("&");

  const hmac = crypto.createHmac("sha512", hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return { ok: signed === secureHash, signed, secureHash, secureHashType };
}
