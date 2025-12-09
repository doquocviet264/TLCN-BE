#!/usr/bin/env node
/**
 * Script kiểm tra VNPay Hash
 * Giúp verify chữ ký VNPAY manually
 *
 * Usage: node verify-vnpay-hash.js
 */

import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Test data từ VNPay sandbox
const testData = {
  // Ví dụ từ VNPay documentation
  vnp_Amount: "100000", // 1,000 VND
  vnp_Command: "pay",
  vnp_CreateDate: "20231201120000",
  vnp_CurrCode: "VND",
  vnp_IpAddr: "127.0.0.1",
  vnp_Locale: "vn",
  vnp_OrderInfo: "Thanhtoan",
  vnp_OrderType: "2000",
  vnp_ReturnUrl: "http://localhost:3000/payment/vnpay/return",
  vnp_TmnCode: process.env.VNP_TMNCODE,
  vnp_TxnRef: "TEST20231201120000",
  vnp_Version: "2.1.0",
};

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj || {})
    .sort()
    .forEach((k) => (sorted[k] = obj[k]));
  return sorted;
}

function buildSignData(params) {
  const ordered = sortObject(params);
  return Object.keys(ordered)
    .map((k) => {
      const encodedValue = encodeURIComponent(String(ordered[k]))
        .replace(/%20/g, "+")
        .replace(/!/g, "%21")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
      return `${k}=${encodedValue}`;
    })
    .join("&");
}

function calculateHash(params, secret) {
  const signStr = buildSignData(params);
  const hmac = crypto.createHmac("sha512", secret);
  const hash = hmac.update(signStr).digest("hex");
  return { signStr, hash };
}

console.log("🔍 VNPay Hash Verification Script");
console.log("==================================\n");

console.log("📋 Configuration:");
console.log(`   VNP_TMNCODE: ${process.env.VNP_TMNCODE}`);
console.log(
  `   VNP_HASHSECRET: ${process.env.VNP_HASHSECRET ? "✅ Set" : "❌ NOT SET"}`
);
console.log(`   VNP_URL: ${process.env.VNP_URL}\n`);

if (!process.env.VNP_HASHSECRET) {
  console.error("❌ ERROR: VNP_HASHSECRET not found in .env");
  process.exit(1);
}

console.log("📝 Test Data:");
console.log(JSON.stringify(testData, null, 2));
console.log();

const secret = process.env.VNP_HASHSECRET;
const { signStr, hash } = calculateHash(testData, secret);

console.log("🔐 Hash Calculation:");
console.log(`\n📌 Sign String:\n${signStr}\n`);
console.log(`📌 Hash Secret (VNP_HASHSECRET):\n${secret}\n`);
console.log(`📌 Calculated Hash (SHA512):\n${hash}\n`);

// Build sample payment URL
const paymentParams = { ...testData };
paymentParams.vnp_SecureHashType = "SHA512";
paymentParams.vnp_SecureHash = hash;

const queryStr = sortObject(paymentParams);
const paymentUrl = `${process.env.VNP_URL}?${Object.keys(queryStr)
  .map((k) => {
    const encodedValue = encodeURIComponent(String(queryStr[k]))
      .replace(/%20/g, "+")
      .replace(/!/g, "%21")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
    return `${k}=${encodedValue}`;
  })
  .join("&")}`;

console.log("🌐 Sample Payment URL:");
console.log(`\n${paymentUrl}\n`);

console.log("✅ Hash verification complete!");
console.log("\n📌 Next Steps:");
console.log("1. Copy the Hash value above");
console.log("2. Paste it in the 'vnp_SecureHash' query parameter");
console.log("3. Test with VNPay Sandbox");
console.log("4. If error 70 persists, check:");
console.log("   - Hash Secret matches VNPay admin");
console.log("   - All parameters are correct");
console.log("   - Encoding is RFC 3986 compliant");
