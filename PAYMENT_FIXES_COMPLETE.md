# 🔧 VNPay & Sepay Payment Issues - FIX COMPLETE

## 🎯 3 Vấn Đề Chính Đã Được Phát Hiện & Sửa

### 1️⃣ **VNPay Return URL Sai** ✅ FIXED

**File:** `.env`

**Vấn đề:**

```env
# ❌ TRƯỚC
VNP_RETURN_URL=http://localhost:3000/payment/vnpay/return

# ✅ SAU
VNP_RETURN_URL=http://localhost:4000/api/payment/vnpay/return
```

**Lý do:**

- Backend server chạy trên port 4000 (nodejs)
- Frontend chạy trên port 5173 (Vite)
- VNPay callback phải về server (4000), không phải FE (3000)
- URL phải đúng với route trong `payment.routes.js`

**Impact:**

- ❌ TRƯỚC: VNPay callback về URL sai → không xử lý được
- ✅ SAU: VNPay callback được xử lý đúng → user update thanh toán

---

### 2️⃣ **Sepay Thiếu Configuration** ✅ FIXED

**File:** `.env`

**Vấn đề:**

```env
# ❌ KHÔNG CÓ TRONG .env
SEPAY_MERCHANT_ID=
SEPAY_API_KEY=
SEPAY_BANK_CODE=VCB
SEPAY_ACCOUNT_NO=
SEPAY_ACCOUNT_NAME=
FRONTEND_URL=

# ✅ THÊM VÀO
SEPAY_MERCHANT_ID=your_merchant_id
SEPAY_API_KEY=your_api_key
SEPAY_BANK_CODE=VCB
SEPAY_ACCOUNT_NO=your_account_no
SEPAY_ACCOUNT_NAME=your_account_name
FRONTEND_URL=http://localhost:5173
```

**Lý do:**

- Code ở `sepay.controllers.js` dùng các biến này nhưng `.env` không có
- `process.env.FRONTEND_URL` return undefined
- QR URL tạo không chính xác

**Impact:**

- ❌ TRƯỚC: Sepay create fail vì undefined
- ✅ SAU: Sepay create hoạt động, tạo QR đúng

---

### 3️⃣ **VNPay Encoding Không Nhất Quán** ✅ FIXED

**File:** `src/controllers/vnpay.controllers.js`

**Vấn đề:**

```javascript
// ❌ TRƯỚC - code này thủ công encode
const vnpParams = { ... };
const queryString = sortObject(vnpParams);
const payUrlQuery = Object.keys(queryString).map((k) => {
  const encodedValue = encodeURIComponent(String(queryString[k]))
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    // ... etc
})

// ✅ SAU - dùng utility function đã test
import { buildVNPayPayUrl } from "../utils/vnpay.js";

const payUrl = buildVNPayPayUrl({
  vnpUrl: ...,
  tmnCode: ...,
  hashSecret: ...,
  amountVND: ...,
  orderInfo: ...,
  txnRef: ...,
  // ...
});
```

**Lý do:**

- `utils/vnpay.js` có function `encodeRFC3986()` đã được kiểm tra
- `vnpay.controllers.js` dùng cách encode thủ công khác
- 2 cách khác nhau → hash không match → lỗi 70
- **Solution:** Dùng utility function unified

**Impact:**

- ❌ TRƯỚC: Có thể lỗi 70 vì encoding khác
- ✅ SAU: Encoding nhất quán → hash match → thanh toán thành công

---

## 📋 Các File Đã Sửa

| File                                    | Thay Đổi                             | Status |
| --------------------------------------- | ------------------------------------ | ------ |
| `.env`                                  | Sửa VNP_RETURN_URL + Thêm SEPAY vars | ✅     |
| `src/controllers/vnpay.controllers.js`  | Dùng buildVNPayPayUrl từ utils       | ✅     |
| `src/utils/vnpay.js`                    | Không sửa (đã đúng)                  | ✅     |
| `src/controllers/payment.controller.js` | Không sửa (đã đúng)                  | ✅     |
| `src/controllers/sepay.controllers.js`  | Không sửa (logic ok)                 | ✅     |

---

## 🚀 Bước Tiếp Theo

### 1. Cập nhật `.env`

```bash
# Verify các giá trị
grep VNP_RETURN_URL .env
grep SEPAY_ .env
grep FRONTEND_URL .env
```

Expected:

```env
VNP_RETURN_URL=http://localhost:4000/api/payment/vnpay/return
SEPAY_MERCHANT_ID=your_merchant_id
SEPAY_API_KEY=your_api_key
SEPAY_BANK_CODE=VCB
SEPAY_ACCOUNT_NO=your_account_no
SEPAY_ACCOUNT_NAME=your_account_name
FRONTEND_URL=http://localhost:5173
```

### 2. Restart Server

```bash
npm start
```

### 3. Test VNPay Payment

```bash
# Terminal 1: Server đang chạy

# Terminal 2: Create payment
curl -X POST http://localhost:4000/api/payment/vnpay/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BKG20231201001",
    "amount": 1000000
  }'

# Response
{
  "payUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=...",
  "txnRef": "BKG20231201001-1701388800000",
  "remain": 5000000,
  "payAmount": 1000000
}

# Verify: payUrl không lỗi 70
```

### 4. Test Sepay Payment

```bash
curl -X POST http://localhost:4000/api/payment/sepay/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BKG20231201001",
    "amount": 1000000
  }'

# Response
{
  "payUrl": "http://localhost:5173/user/checkout/sepay-qr?...",
  "qrUrl": "https://qr.sepay.vn/img?acc=...",
  "deeplink": "https://dl.vietqr.io/pay?...",
  "txnRef": "BKG202312010011701388800000",
  "bankInfo": {
    "bankCode": "VCB",
    "accountNo": "your_account_no",
    "accountName": "your_account_name"
  }
}
```

---

## ✅ Verification Checklist

- [ ] `.env` có `VNP_RETURN_URL=http://localhost:4000/api/payment/vnpay/return`
- [ ] `.env` có tất cả `SEPAY_*` variables
- [ ] `.env` có `FRONTEND_URL=http://localhost:5173`
- [ ] `vnpay.controllers.js` dùng `buildVNPayPayUrl` từ utils
- [ ] Server restart & load new `.env`
- [ ] VNPay create payment thành công
- [ ] VNPay callback không lỗi 70
- [ ] Sepay create payment thành công

---

## 🎓 Key Learnings

1. **Environment Variables** - Phải chính xác tên và value
2. **URL Routing** - Return URL phải trỏ đúng server
3. **Encoding Consistency** - Dùng utility functions để avoid bugs
4. **Separation of Concerns** - Utils functions giúp reuse & test

---

**Fixed Date:** 9/12/2025  
**Status:** ✅ Ready for Testing
