# 🔧 VNPay Lỗi 70 - Hướng Dẫn Sửa Chữa Hoàn Chỉnh

## 🎯 Vấn Đề

Lỗi **"Sai chữ ký (Mã lỗi 70)"** khi thanh toán qua VNPay

## 🔴 Nguyên Nhân Root Cause

Code sử dụng sai tên biến environment:

- ❌ **SAIS**: `process.env.VNP_HASH_SECRET` (undefined)
- ✅ **ĐÚNG**: `process.env.VNP_HASHSECRET` (từ .env)

Khi VNPay gửi callback verify, server nhận `undefined` → hash validation fail → error 70

---

## 📦 Các File Đã Sửa

| File                                    | Thay Đổi             | Status |
| --------------------------------------- | -------------------- | ------ |
| `src/controllers/payment.controller.js` | Sửa tên biến (2 chỗ) | ✅     |
| `src/controllers/vnpay.controllers.js`  | Cải thiện encoding   | ✅     |
| `VNPAY_DEBUG_GUIDE.md`                  | Thêm hướng dẫn       | ✅     |
| `VNPAY_FIXES_SUMMARY.md`                | Tóm tắt thay đổi     | ✅     |
| `verify-vnpay-hash.js`                  | Script verification  | ✅     |
| `check-vnpay-fix.sh`                    | Bash script check    | ✅     |

---

## ⚡ QUICK FIX (5 Phút)

### Bước 1: Xác Nhận .env

```env
# ✅ ĐÚNG
VNP_HASHSECRET=I17W7L24RDVQ61ERF574Y6B6SCVZVJGD

# ❌ XÓA cái này nếu có
VNP_HASH_SECRET=...
```

### Bước 2: Xác Nhận Code

File `src/controllers/payment.controller.js` (2 chỗ):

```javascript
// ✅ ĐÚNG
const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASHSECRET);
```

### Bước 3: Restart Server

```bash
npm start
```

### Bước 4: Test

```bash
node verify-vnpay-hash.js
```

---

## 🧪 DETAILED TESTING

### 1. Verify Configuration

```bash
# Chạy script check
bash check-vnpay-fix.sh
```

**Output Expected:**

```
✅ VNP_HASHSECRET found in .env
✅ No old VNP_HASH_SECRET found
✅ Uses VNP_HASHSECRET
✅ buildSignData() function exists
✅ No qs.stringify found
```

### 2. Verify Hash Calculation

```bash
# Chạy script tính hash
node verify-vnpay-hash.js
```

**Output Expected:**

```
📋 Configuration:
   VNP_TMNCODE: F6PUGU6Q
   VNP_HASHSECRET: ✅ Set
   VNP_URL: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html

📌 Sign String:
vnp_Amount=100000&vnp_Command=pay&...

📌 Calculated Hash (SHA512):
a1b2c3d4...

🌐 Sample Payment URL:
https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=100000&...
```

### 3. Test Payment Flow

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Test create payment
curl -X POST http://localhost:4000/api/payment/vnpay/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BKG20231201001",
    "amount": 1000000
  }'
```

**Expected Response:**

```json
{
  "payUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=1000000&...",
  "txnRef": "BKG20231201001-1701388800000",
  "remain": 5000000,
  "payAmount": 1000000
}
```

### 4. Monitor Logs

Khi test, kiểm tra logs server:

```
VNPAY Sign String: vnp_Amount=1000000&vnp_Command=pay&...&vnp_TmnCode=F6PUGU6Q...
VNPAY Secure Hash: abc123def456...
```

### 5. Test VNPay Sandbox

1. Copy `payUrl` từ response
2. Paste vào browser
3. Nếu không lỗi 70 → ✅ FIX THÀNH CÔNG!

---

## 📋 CHECKLIST

- [ ] `.env` có `VNP_HASHSECRET`
- [ ] Không có `VNP_HASH_SECRET` trong code
- [ ] `payment.controller.js` line 39 & 102 sửa xong
- [ ] `vnpay.controllers.js` có `buildSignData()`
- [ ] Xóa import `qs` khỏi `vnpay.controllers.js`
- [ ] Server restarted
- [ ] Chạy `verify-vnpay-hash.js` thành công
- [ ] Chạy `check-vnpay-fix.sh` thành công
- [ ] Test payment không lỗi 70 ✅

---

## 🚨 Nếu Vẫn Gặp Lỗi

### Bước 1: Verify Hash Secret

- Đăng nhập VNPay Sandbox Admin
- Check Hash Secret khớp với `.env` không?
- **Phải chính xác 100%**

### Bước 2: Check Logs

```
VNPAY Sign String: ...
VNPAY Secure Hash: ...
```

Copy 2 giá trị này và so sánh

### Bước 3: Manual Hash Verification

Dùng [SHA512 Online Tool](https://emn178.github.io/online-tools/sha512.html):

1. Input: VNPAY Sign String + Secret Key
2. Output: So sánh với VNPAY Secure Hash

### Bước 4: Contact VNPay Support

- Cung cấp: TMN Code, Timestamp, Error Code 70
- Ask: "Why validation failed for this signature?"

---

## 📚 Tài Liệu Tham Khảo

- [VNPay Integration Guide](https://vnpayment.vn/documents/vnpay-payment-gateway.pdf)
- [VNPay Sandbox Admin](https://sandbox.vnpayment.vn/merchant)
- [VNPAY_DEBUG_GUIDE.md](./VNPAY_DEBUG_GUIDE.md) - Chi tiết kỹ thuật
- [VNPAY_FIXES_SUMMARY.md](./VNPAY_FIXES_SUMMARY.md) - Tóm tắt thay đổi

---

## 🎓 Bài Học

**Key Points:**

1. ✅ Environment variable names phải **chính xác 100%**
2. ✅ Hash algorithm & encoding phải **tuân thủ spec**
3. ✅ **Test early, test often** - mỗi lần sửa phải test
4. ✅ **Log everything** - dễ debug

**Cách Tránh Lỗi Tương Tự:**

- Dùng TypeScript để catch lỗi variable naming
- Viết unit tests cho hash calculation
- Setup pre-commit hooks để validate config
- Documentation rõ ràng cho team

---

**Version**: 1.0  
**Updated**: 6/12/2025  
**Status**: ✅ Ready for Testing
