import crypto from "crypto";

/**
 * Tạo chữ ký HMAC-SHA256 cho MoMo (v2)
 * rawSignature format PHẢI đúng thứ tự tài liệu MoMo
 */
export function signMoMo(rawSignature, secretKey) {
  return crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
}

/**
 * Gọi MoMo để tạo giao dịch và trả về payUrl + deeplink
 * @param {Object} p
 * @param {string} p.partnerCode
 * @param {string} p.accessKey
 * @param {string} p.secretKey
 * @param {string} p.momoApi (https://test-payment.momo.vn/v2/gateway/api/create)
 * @param {string} p.redirectUrl
 * @param {string} p.ipnUrl
 * @param {string|number} p.amountVND
 * @param {string} p.orderId
 * @param {string} p.requestId
 * @param {string} p.orderInfo
 * @param {string} [p.requestType="captureWallet"] // "captureWallet" | "payWithATM"
 * @param {string} [p.extraData=""]
 * @returns {Promise<{payUrl?:string, deeplink?:string, error?:string, raw:any}>}
 */
export async function createMoMoPayment({
  partnerCode,
  accessKey,
  secretKey,
  momoApi,
  redirectUrl,
  ipnUrl,
  amountVND,
  orderId,
  requestId,
  orderInfo,
  requestType = "captureWallet",
  extraData = ""
}) {

  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${amountVND}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`;

  const signature = signMoMo(rawSignature, secretKey);

  const body = {
    partnerCode,
    accessKey,
    requestId,
    amount: String(amountVND),
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang: "vi"
  };

  const resp = await fetch(momoApi, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.resultCode !== 0) {
    return { error: data.message || `MoMo error ${resp.status}`, raw: data };
  }
  // data.payUrl (web) | data.deeplink (app)
  return { payUrl: data.payUrl, deeplink: data.deeplink, raw: data };
}

/**
 * Xác minh IPN/Return từ MoMo
 * Dựa theo format chữ ký IPN MoMo v2
 * @param {object} q Object query/body do MoMo gửi về
 * @param {string} secretKey
 */
export function verifyMoMoIPN(q, secretKey) {
  // Tài liệu MoMo: rawSignature IPN gồm các trường sau (đúng thứ tự!)
  // accessKey=&amount=&extraData=&message=&orderId=&orderInfo=&orderType=&partnerCode=&payType=&requestId=&responseTime=&resultCode=&transId=
  const rawSignature =
    `accessKey=${q.accessKey}` +
    `&amount=${q.amount}` +
    `&extraData=${q.extraData || ""}` +
    `&message=${q.message}` +
    `&orderId=${q.orderId}` +
    `&orderInfo=${q.orderInfo}` +
    `&orderType=${q.orderType || ""}` +
    `&partnerCode=${q.partnerCode}` +
    `&payType=${q.payType || ""}` +
    `&requestId=${q.requestId}` +
    `&responseTime=${q.responseTime}` +
    `&resultCode=${q.resultCode}` +
    `&transId=${q.transId}`;

  const calc = signMoMo(rawSignature, secretKey);
  return String(calc).toLowerCase() === String(q.signature || "").toLowerCase();
}
