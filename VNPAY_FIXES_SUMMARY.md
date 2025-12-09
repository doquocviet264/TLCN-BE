# VNPay Lỗi 70 - SUMMARY CÁC THAY ĐỔI

## 🎯 VẤN ĐỀ CHÍNH

**Sử dụng sai tên biến environment: `VNP_HASH_SECRET` thay vì `VNP_HASHSECRET`**

Khi VNPay gửi callback về, server nhận `undefined` thay vì hash secret → hash validation fail → lỗi 70

---

## 📝 CÁC FILE ĐÃ SỬA

### 1. `src/controllers/payment.controller.js`

**Sửa 2 chỗ dùng sai tên biến:**

```javascript
// ❌ TRƯỚC
const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASH_SECRET);

// ✅ SAU
const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASHSECRET);
```

**Dòng đã sửa:**

- Line 39 (trong `vnpReturn()`)
- Line 102 (trong `vnpIpn()`)

---

### 2. `src/controllers/vnpay.controllers.js`

**Cải thiện encoding consistency:**

- ✅ Thêm hàm `buildSignData()` để standardize encoding
- ✅ Loại bỏ `qs.stringify()` (có thể encode khác)
- ✅ Dùng RFC 3986 encoding cho tất cả tham số
- ✅ Xóa import `qs` không cần thiết

---

### 3. `VNPAY_DEBUG_GUIDE.md` (CẬP NHẬT)

Thêm hướng dẫn chi tiết:

- ✅ Phát hiện vấn đề (sai tên biến)
- ✅ Hướng dẫn chạy script verification
- ✅ Flow thanh toán hoàn chỉnh
- ✅ Danh sách kiểm tra

---

### 4. `verify-vnpay-hash.js` (MỚI)

Script giúp verify hash:

```bash
node verify-vnpay-hash.js
```

Output:

- ✅ Configuration check (TMN Code, Hash Secret)
- ✅ Test data
- ✅ Sign String & Hash calculation
- ✅ Sample payment URL

---

## ✅ ACTION ITEMS

### Ngay Lập Tức

1. **Đảm bảo `.env` có `VNP_HASHSECRET`** (không phải `VNP_HASH_SECRET`)
2. **Restart server** để load lại .env
3. **Test payment** để xem lỗi 70 còn không

### Nếu Vẫn Lỗi

1. Chạy script: `node verify-vnpay-hash.js`
2. Kiểm tra logs server: `VNPAY Sign String` & `VNPAY Secure Hash`
3. So sánh hash từ logs có khớp không
4. Verify Hash Secret với VNPay admin

---

## 📋 CHECKLIST ĐỂ CONFIRM FIX

- [ ] `.env` có `VNP_HASHSECRET=I17W7L24RDVQ61ERF574Y6B6SCVZVJGD`
- [ ] Code không còn dùng `VNP_HASH_SECRET`
- [ ] Server restarted
- [ ] Test payment flow
- [ ] Không còn lỗi 70 ✅

---

## 🚀 CHẠY TEST

```bash
# 1. Verify config
node verify-vnpay-hash.js

# 2. Start server
npm start

# 3. Test API
curl -X POST http://localhost:4000/api/payment/vnpay/create \
  -H "Content-Type: application/json" \
  -d '{"code":"BKG123","amount":1000000}'

# 4. Check logs for:
# - VNPAY Sign String: ...
# - VNPAY Secure Hash: ...
```

---

**Updated:** 6/12/2025
