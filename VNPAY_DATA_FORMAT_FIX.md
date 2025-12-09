# 🔧 VNPay Data Format Fixes

## 🔴 3 Vấn Đề Định Dạng Dữ Liệu Được Phát Hiện

### Vấn Đề 1: vnp_CreateDate Format Sai ✅ FIXED

**File:** `src/utils/vnpay.js` dòng 35-40

**Vấn đề:**

```javascript
// ❌ TRƯỚC - Cách slice có thể sai
vnp_CreateDate: new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, "")
  .slice(0, 14);

// Ví dụ:
// new Date().toISOString() => "2023-12-01T12:00:00.123Z"
// Sau replace => "20231201120000123"
// Slice (0,14) => "20231201120000" ✅ (may be ok)
// Nhưng nếu milliseconds => "202312011200001" (sai!)
```

**Giải pháp:**

```javascript
// ✅ SAU - Sử dụng pad() để đảm bảo format đúng
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const createDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
  now.getDate()
)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
// => "20231201120000" (luôn đúng 14 ký tự)
```

---

### Vấn Đề 2: vnp_TxnRef Chứa Ký Tự `-` ✅ FIXED

**File:** `src/controllers/vnpay.controllers.js` dòng 64

**Vấn đề:**

```javascript
// ❌ TRƯỚC
const txnRef = `${booking.code}-${Date.now()}`;
// => "BKG001-1701388800000" (chứa dấu gạch)

// Vấn đề:
// - VNPay yêu cầu alphanumeric
// - Dấu "-" có thể gây lỗi encoding
// - Định dạng không chuẩn
```

**Giải pháp:**

```javascript
// ✅ SAU - Chỉ alphanumeric
const txnRef = `${booking.code}${Date.now()}`;
// => "BKG0011701388800000" (chỉ số và chữ)
```

---

### Vấn Đề 3: verifyVNPayChecksum Encoding Không Nhất Quán ✅ FIXED

**File:** `src/utils/vnpay.js` dòng 73

**Vấn đề:**

```javascript
// ❌ TRƯỚC - buildSignedQuery dùng encodeRFC3986
const { secureHash } = buildSignedQuery(vnp_Params, hashSecret);

// ❌ NHƯNG verifyVNPayChecksum dùng encodeURIComponent
const signData = sortedKeys
  .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`)
  .join("&");

// Khác nhau => hash verify fail!
```

**Giải pháp:**

```javascript
// ✅ SAU - Cả hai dùng encodeRFC3986
export function verifyVNPayChecksum(query, hashSecret) {
  // ...
  const signData = sortedKeys
    .map((k) => `${k}=${encodeRFC3986(params[k])}`)
    .join("&");
  // Dùng cùng function -> hash match
}
```

---

## 📝 Chi Tiết Các Thay Đổi

### Change 1: Date Format dengan Pad Function

```javascript
// utils/vnpay.js - buildVNPayPayUrl()

// Thêm function pad
const pad = (n) => String(n).padStart(2, "0");

// Format date đúng chuẩn
const createDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
  now.getDate()
)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

// Kết quả: "20231201120000" (14 chars, yyyyMMddHHmmss)
```

### Change 2: TxnRef Alphanumeric Only

```javascript
// controllers/vnpay.controllers.js - vnpCreate()

// Trước
const txnRef = `${booking.code}-${Date.now()}`;

// Sau
const txnRef = `${booking.code}${Date.now()}`;

// Format: alphanumeric, no special chars
```

### Change 3: Encoding Consistency

```javascript
// utils/vnpay.js - verifyVNPayChecksum()

// Trước
const signData = sortedKeys
  .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`)
  .join("&");

// Sau
const signData = sortedKeys
  .map((k) => `${k}=${encodeRFC3986(params[k])}`)
  .join("&");

// Sử dụng cùng function như buildSignedQuery
```

---

## 🧪 Test Format Verification

Chạy script để verify tất cả format:

```bash
node test-vnpay-format.js
```

**Expected Output:**

```
🔍 VNPay Data Format Verification

1️⃣ Date Format Test:
   Format: yyyyMMddHHmmss
   Value: 20231201120000
   Length: 14 (phải = 14)
   Valid: ✅

2️⃣ TxnRef Format Test:
   Format: alphanumeric (không dấu gạch)
   Value: BKG0011701388800000
   Contains '-': ✅
   Alphanumeric: ✅

3️⃣ Amount Format Test:
   Input: 1000000 VND
   Multiply by 100: 100000000
   Rounded: 100000000
   As String: "100000000"
   Value: 100000000
   Valid: ✅

4️⃣ Encoding Consistency Test:
   Testing encodeRFC3986():
     "Thanhtoan BKG001" -> "Thanhtoan+BKG001"
     "Test!Value" -> "Test%21Value"
     "Order(123)" -> "Order%28123%29"

5️⃣ Parameter Structure Test:
   [All required parameters listed]

6️⃣ Signature Generation Test:
   [SecureHash generated]

7️⃣ Full Payment URL Test:
   [URL generated]

✅ All Format Checks Complete!
```

---

## 🚀 Test Payment Flow

### 1. Verify Config

```bash
grep -E "VNP_|SEPAY_|FRONTEND" .env
```

### 2. Run Format Test

```bash
node test-vnpay-format.js
```

### 3. Restart Server

```bash
npm start
```

### 4. Create Payment

```bash
curl -X POST http://localhost:4000/api/payment/vnpay/create \
  -H "Content-Type: application/json" \
  -d '{"code":"BKG001","amount":1000000}'
```

**Expected Response:**

```json
{
  "payUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=100000000&vnp_Command=pay&...",
  "txnRef": "BKG0011701388800000",
  "remain": 5000000,
  "payAmount": 1000000
}
```

### 5. Verify Logs

Check server logs:

```
[Payment Info]
TxnRef: BKG0011701388800000 (alphanumeric ✅)
CreateDate: 20231201120000 (14 chars ✅)
Amount: 100000000 (VND * 100 ✅)
```

---

## ✅ Data Format Checklist

- [x] vnp_CreateDate: yyyyMMddHHmmss (14 chars)
- [x] vnp_TxnRef: alphanumeric only (no dashes)
- [x] vnp_Amount: VND \* 100 (rounded to integer)
- [x] vnp_OrderInfo: string type
- [x] encodeRFC3986: consistent in sign & verify
- [x] All parameters: string type (coerced with String())

---

**Updated:** 9/12/2025  
**Status:** ✅ Ready for Production Testing
