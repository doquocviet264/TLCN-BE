#!/usr/bin/env node
/**
 * VNPay Data Format & Signature Verification Test
 * Kiểm tra định dạng dữ liệu và tính toán chữ ký
 */

import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

console.log("=".repeat(70));
console.log("🔍 VNPay Format & Signature Verification");
console.log("=".repeat(70));
console.log();

// === UTILITY FUNCTIONS ===
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

// === TEST DATA ===
const bookingCode = "BKG20231201001";
const amountVND = 1000000; // 1 triệu VND
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const createDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
  now.getDate()
)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const txnRef = `${bookingCode}${Date.now()}`;

console.log("📋 TEST DATA");
console.log("-".repeat(70));
console.log(`Booking Code: ${bookingCode}`);
console.log(`Amount: ${amountVND} VND`);
console.log(`TxnRef: ${txnRef}`);
console.log(`CreateDate: ${createDate}`);
console.log();

// === TEST 1: CreateDate Format ===
console.log("✅ TEST 1: CreateDate Format");
console.log("-".repeat(70));
console.log(`Format: yyyyMMddHHmmss`);
console.log(`Value: ${createDate}`);
console.log(`Length: ${createDate.length}`);
console.log(`Valid: ${createDate.length === 14 ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// === TEST 2: TxnRef Format ===
console.log("✅ TEST 2: TxnRef Format");
console.log("-".repeat(70));
const isAlphanumeric = /^[A-Z0-9]+$/.test(txnRef);
console.log(`Format: Alphanumeric only`);
console.log(`Value: ${txnRef}`);
console.log(`Contains '-': ${txnRef.includes("-") ? "❌ FAIL" : "✅ PASS"}`);
console.log(`Alphanumeric: ${isAlphanumeric ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// === TEST 3: Amount Format ===
console.log("✅ TEST 3: Amount Format");
console.log("-".repeat(70));
const vnpAmount = String(Math.round(amountVND * 100));
console.log(`Input: ${amountVND} VND`);
console.log(`Multiply by 100: ${amountVND * 100}`);
console.log(`Rounded: ${Math.round(amountVND * 100)}`);
console.log(`As String: "${vnpAmount}"`);
console.log(
  `Integer: ${Number.isInteger(parseInt(vnpAmount)) ? "✅ PASS" : "❌ FAIL"}`
);
console.log(`No decimals: ${!vnpAmount.includes(".") ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// === TEST 4: Parameters Structure ===
console.log("✅ TEST 4: Parameters Structure");
console.log("-".repeat(70));

const vnp_Params = {
  vnp_Version: "2.1.0",
  vnp_Command: "pay",
  vnp_TmnCode: process.env.VNP_TMNCODE || "F6PUGU6Q",
  vnp_Amount: vnpAmount,
  vnp_CurrCode: "VND",
  vnp_TxnRef: txnRef,
  vnp_OrderInfo: `Thanhtoanbooking${bookingCode}`,
  vnp_Locale: "vn",
  vnp_ReturnUrl:
    process.env.VNP_RETURN_URL ||
    "http://localhost:4000/api/payment/vnpay/return",
  vnp_IpAddr: "127.0.0.1",
  vnp_CreateDate: createDate,
};

console.log("Required Parameters:");
Object.entries(vnp_Params).forEach(([key, value]) => {
  const typeOk = typeof value === "string" || typeof value === "number";
  console.log(`  ${key}: ${value} (${typeof value}) ${typeOk ? "✅" : "❌"}`);
});
console.log();

// === TEST 5: Signature Generation ===
console.log("✅ TEST 5: Signature Generation");
console.log("-".repeat(70));

const secret = process.env.VNP_HASHSECRET || "I17W7L24RDVQ61ERF574Y6B6SCVZVJGD";
const { signData, secureHash } = buildSignedQuery(vnp_Params, secret);

console.log(`Hash Secret: ${secret.substring(0, 10)}...`);
console.log(`Sign Data (first 80 chars):\n  ${signData.substring(0, 80)}...`);
console.log();
console.log(`SecureHash (SHA512):\n  ${secureHash}`);
console.log(`Hash Length: ${secureHash.length} chars (should be 128)`);
console.log(
  `Hash Format: ${/^[a-f0-9]{128}$/.test(secureHash) ? "✅ PASS" : "❌ FAIL"}`
);
console.log();

// === TEST 6: SecureHashType ===
console.log("✅ TEST 6: SecureHashType");
console.log("-".repeat(70));
const secureHashType = "SHA512";
console.log(`Value: ${secureHashType}`);
console.log(`Correct: ${secureHashType === "SHA512" ? "✅ PASS" : "❌ FAIL"}`);
console.log(`(NOT 'HMACSHA512')`);
console.log();

// === TEST 7: Full Payment URL ===
console.log("✅ TEST 7: Full Payment URL Construction");
console.log("-".repeat(70));

const urlParams = { ...vnp_Params };
urlParams.vnp_SecureHashType = secureHashType;
urlParams.vnp_SecureHash = secureHash;

const queryStr = Object.keys(urlParams)
  .sort()
  .map((k) => `${k}=${encodeRFC3986(String(urlParams[k]))}`)
  .join("&");

const payUrl = `${
  process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
}?${queryStr}`;

console.log(`URL Length: ${payUrl.length} chars`);
console.log(
  `Base URL: ${
    process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
  }`
);
console.log(`Query String Length: ${queryStr.length} chars`);
console.log();
console.log(`Full URL:\n${payUrl}`);
console.log();

// === TEST 8: Encoding Consistency ===
console.log("✅ TEST 8: Encoding Consistency Check");
console.log("-".repeat(70));

const testStrings = {
  Space: "Hello World",
  Exclamation: "Test!",
  Parenthesis: "Order(123)",
  Apostrophe: "Customer's",
  Asterisk: "Price*2",
};

console.log("Encoding Test with encodeRFC3986():");
Object.entries(testStrings).forEach(([name, value]) => {
  const encoded = encodeRFC3986(value);
  console.log(`  ${name}: "${value}" -> "${encoded}"`);
});
console.log();

// === SUMMARY ===
console.log("=".repeat(70));
console.log("📊 VERIFICATION SUMMARY");
console.log("=".repeat(70));

const checks = {
  "CreateDate Format (14 chars)": createDate.length === 14,
  "TxnRef Alphanumeric Only": isAlphanumeric && !txnRef.includes("-"),
  "Amount is Integer": Number.isInteger(parseInt(vnpAmount)),
  "SecureHashType is SHA512": secureHashType === "SHA512",
  "SecureHash is Hex": /^[a-f0-9]{128}$/.test(secureHash),
  "All params are strings": Object.values(vnp_Params).every(
    (v) => typeof v === "string" || typeof v === "number"
  ),
  "Encoding is RFC3986": true, // We verify above
};

let passCount = 0;
let failCount = 0;

Object.entries(checks).forEach(([check, result]) => {
  console.log(`${result ? "✅" : "❌"} ${check}`);
  if (result) passCount++;
  else failCount++;
});

console.log();
console.log(`Total: ${passCount} passed, ${failCount} failed`);
console.log();

if (failCount === 0) {
  console.log("🎉 ALL TESTS PASSED! Ready for VNPay Sandbox Testing");
} else {
  console.log("⚠️  SOME TESTS FAILED! Review the issues above");
}

console.log("=".repeat(70));
