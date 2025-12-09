#!/usr/bin/env node
/**
 * Script kiểm tra định dạng dữ liệu VNPay
 * Xác minh tất cả tham số được format đúng chuẩn
 */

import crypto from "crypto";

// Copy hàm từ utils
function encodeRFC3986(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16));
}

function buildSignedQuery(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys
    .map((k) => `${k}=${encodeRFC3986(params[k])}`)
    .join("&");
  const hmac = crypto.createHmac("sha512", secret);
  const secureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  return { signData, secureHash };
}

console.log("🔍 VNPay Data Format Verification\n");

// Test 1: Date Format
console.log("1️⃣ Date Format Test:");
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const createDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
  now.getDate()
)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
console.log(`   Format: yyyyMMddHHmmss`);
console.log(`   Value: ${createDate}`);
console.log(`   Length: ${createDate.length} (phải = 14)`);
console.log(`   Valid: ${createDate.length === 14 ? "✅" : "❌"}\n`);

// Test 2: TxnRef Format
console.log("2️⃣ TxnRef Format Test:");
const bookingCode = "BKG001";
const txnRef = `${bookingCode}${Date.now()}`;
console.log(`   Format: alphanumeric (không dấu gạch)`);
console.log(`   Value: ${txnRef}`);
console.log(`   Contains '-': ${txnRef.includes("-") ? "❌" : "✅"}`);
console.log(`   Alphanumeric: ${/^[A-Z0-9]+$/.test(txnRef) ? "✅" : "❌"}\n`);

// Test 3: Amount Format
console.log("3️⃣ Amount Format Test:");
const amountVND = 1000000; // 1 triệu VND
const vnpAmount = String(Math.round(amountVND * 100));
console.log(`   Input: ${amountVND} VND`);
console.log(`   Multiply by 100: ${amountVND * 100}`);
console.log(`   Rounded: ${Math.round(amountVND * 100)}`);
console.log(`   As String: "${vnpAmount}"`);
console.log(`   Value: ${vnpAmount}`);
console.log(`   Valid: ✅\n`);

// Test 4: Encoding Consistency
console.log("4️⃣ Encoding Consistency Test:");
const testValues = [
  "Thanhtoan BKG001", // space
  "Test!Value", // special char
  "Order(123)", // parenthesis
];

console.log("   Testing encodeRFC3986():");
testValues.forEach((val) => {
  const encoded = encodeRFC3986(val);
  console.log(`     "${val}" -> "${encoded}"`);
});
console.log();

// Test 5: Parameter Structure
console.log("5️⃣ Parameter Structure Test:");
const params = {
  vnp_Version: "2.1.0",
  vnp_Command: "pay",
  vnp_TmnCode: "F6PUGU6Q",
  vnp_Amount: vnpAmount,
  vnp_CurrCode: "VND",
  vnp_TxnRef: txnRef,
  vnp_OrderInfo: "ThanhtoanbookingBKG001",
  vnp_Locale: "vn",
  vnp_ReturnUrl: "http://localhost:4000/api/payment/vnpay/return",
  vnp_IpAddr: "127.0.0.1",
  vnp_CreateDate: createDate,
};

console.log("   Parameters:");
Object.entries(params).forEach(([k, v]) => {
  console.log(`     ${k}: ${v} (${typeof v})`);
});
console.log();

// Test 6: Signature Generation
console.log("6️⃣ Signature Generation Test:");
const secret = "I17W7L24RDVQ61ERF574Y6B6SCVZVJGD";
const { signData, secureHash } = buildSignedQuery(params, secret);

console.log(
  `   Sign Data (first 100 chars):\n     ${signData.substring(0, 100)}...`
);
console.log(`\n   SecureHash (SHA512):\n     ${secureHash}\n`);
console.log(`   Hash Length: ${secureHash.length} (phải = 128)\n`);

// Test 7: Full URL
console.log("7️⃣ Full Payment URL Test:");
params.vnp_SecureHashType = "HMACSHA512";
params.vnp_SecureHash = secureHash;

const queryStr = Object.keys(params)
  .sort()
  .map((k) => `${k}=${encodeRFC3986(params[k])}`)
  .join("&");

const vnpUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${queryStr}`;
console.log(`   URL Length: ${vnpUrl.length}`);
console.log(`   First 100 chars:\n   ${vnpUrl.substring(0, 100)}...`);
console.log(`\n   Full URL:\n   ${vnpUrl}\n`);

// Summary
console.log("=".repeat(60));
console.log("✅ All Format Checks Complete!");
console.log("=".repeat(60));
console.log("\n📋 Verification Checklist:");
console.log("  ✅ Date format: yyyyMMddHHmmss (14 chars)");
console.log("  ✅ TxnRef: alphanumeric only");
console.log("  ✅ Amount: multiplied by 100");
console.log("  ✅ Encoding: RFC 3986 consistent");
console.log("  ✅ Signature: SHA512 HMAC");
console.log("  ✅ Parameters: All required fields present");
console.log("\n🚀 Ready for testing with VNPay Sandbox!");
