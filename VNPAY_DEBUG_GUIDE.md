# VNPay Lỗi 70 - Hướng Dẫn Sửa Chữa

## 🔥 Lỗi 70: "Sai chữ ký" (Invalid Signature)

### Nguyên Nhân Chính

Lỗi này xảy ra khi VNPay không thể verify chữ ký (SecureHash) bạn gửi. Điều này thường do:

1. **Mã bí mật (Hash Secret) sai** ❌
2. **Cách tính hash không theo đúng quy chuẩn VNPay** ❌
3. **Cách encode tham số không nhất quán** ❌
4. **Dùng sai tên biến môi trường** ❌ **← NGUYÊN NHÂN CHÍNH CỦA BẠN**

---

## 🔧 Các Sửa Chữa Đã Thực Hiện

### ✅ Fix 1: Sửa Tên Biến Môi Trường (CRITICAL)

**File:** `src/controllers/payment.controller.js`

**Vấn đề:** Code đang dùng `process.env.VNP_HASH_SECRET` nhưng `.env` có `VNP_HASHSECRET` (khác!)

```javascript
// ❌ TRƯỚC (SAI)
const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASH_SECRET); // undefined!

// ✅ SAU (ĐÚNG)
const { ok } = verifyVNPayChecksum(q, process.env.VNP_HASHSECRET); // Đúng tên
```

**Đã sửa 2 chỗ:**

- `vnpReturn()` - dòng 39
- `vnpIpn()` - dòng 102

### ✅ Fix 2: Encoding Nhất Quán

**File:** `src/controllers/vnpay.controllers.js`

Thêm hàm `buildSignData()` để đảm bảo tất cả encoding (tạo signature + tạo URL) đều nhất quán:

```javascript
function buildSignData(params) {
  const ordered = sortObject(params);
  return Object.keys(ordered)
    .map((k) => {
      const encodedValue = encodeURIComponent(String(ordered[k]))
        .replace(/%20/g, "+") // VNPay yêu cầu space => +
        .replace(/!/g, "%21")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
      return `${k}=${encodedValue}`;
    })
    .join("&");
}
```

### ✅ Fix 3: Loại Bỏ `qs.stringify()`

Trước: `qs.stringify(vnpParams, { encode: true })` - có thể encode khác
Sau: Dùng `buildSignData()` thủ công - đảm bảo nhất quán

---

## 🧪 Các Bước Kiểm Tra

### 1️⃣ Kiểm Tra Tên Biến Môi Trường (QUAN TRỌNG NHẤT)

**File:** `.env`

Phải là `VNP_HASHSECRET` **KHÔNG** phải `VNP_HASH_SECRET`:

```env
VNP_HASHSECRET=I17W7L24RDVQ61ERF574Y6B6SCVZVJGD  ✅ ĐÚNG
VNP_HASH_SECRET=...  ❌ SAI
```

### 2️⃣ Chạy Script Verification

Tôi đã tạo script `verify-vnpay-hash.js` để kiểm tra hash:

```bash
node verify-vnpay-hash.js
```

Output sẽ hiển thị:

- ✅ Configuration (TMN Code, Hash Secret)
- 📝 Test Data (các tham số)
- 🔐 Hash Calculation (Sign String & Hash)
- 🌐 Sample Payment URL

### 3️⃣ Kiểm Tra Logs Khi Thanh Toán

Khi gửi yêu cầu thanh toán, kiểm tra terminal server:

```
VNPAY Sign String: vnp_Amount=1000000&vnp_Command=pay&...
VNPAY Secure Hash: a1b2c3d4...
```

**Để debug:**

1. Copy toàn bộ "Sign String" từ log
2. Copy "Secure Hash" từ log
3. Xác minh hash được tính đúng (có thể dùng [SHA512 Online](https://emn178.github.io/online-tools/sha512.html))

### 4️⃣ Kiểm Tra Tham Số Yêu Cầu

VNPay yêu cầu các tham số bắt buộc:

- ✅ `vnp_TmnCode` - Mã đơn vị (TMN Code): `F6PUGU6Q`
- ✅ `vnp_Amount` - Số tiền (VND \* 100)
- ✅ `vnp_CreateDate` - Ngày tạo (format: yyyyMMddHHmmss)
- ✅ `vnp_IpAddr` - Địa chỉ IP
- ✅ `vnp_Command` - "pay"
- ✅ `vnp_Version` - "2.1.0"
- ✅ `vnp_SecureHash` - Chữ ký SHA512
- ✅ `vnp_SecureHashType` - "SHA512"

### 5️⃣ Flow Thanh Toán Hoàn Chỉnh

```
1️⃣ TẠNG YÊU CẦU THANH TOÁN (Client → Backend)
   └─ POST /api/payment/vnpay/create
      ├─ Body: { code: "BKG...", amount: 1000000 }
      └─ Response: { payUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=..." }

2️⃣ TÍNH HASH (Backend)
   └─ buildSignData() + SHA512
      ├─ Sort all params alphabetically
      ├─ Encode RFC 3986 (space→+, !→%21, etc.)
      ├─ Calculate HMAC-SHA512 with VNP_HASHSECRET
      └─ Append vnp_SecureHash to URL

3️⃣ CHUYỂN HƯỚNG ĐẾN VNPAY (Client)
   └─ GET https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=...&vnp_SecureHash=abc123...
      ├─ User enters card info
      └─ VNPay validates hash
         ├─ If hash matches → allow payment
         └─ If hash fails → return error 70 ❌

4️⃣ VNPay XỬ LÝ THANH TOÁN
   └─ Verify hash using same secret
      └─ If OK → redirect user back to VNP_RETURN_URL

5️⃣ RETURN CALLBACK (VNPay → Backend)
   └─ GET /api/payment/vnpay/return?vnp_Amount=...&vnp_SecureHash=...
      └─ verifyVNPayChecksum() with VNP_HASHSECRET  ← PHẢI DÙNG ĐÚNG BIẾN!
         ├─ If signature matches → Mark as paid ✅
         └─ If signature fails → Reject payment ❌

6️⃣ SHOW RESULT (Backend → Frontend)
   └─ Redirect to /payment?status=success or ?status=failed
```

### 6️⃣ Test Quy Trình

```bash
# 1. Tạo yêu cầu thanh toán
POST /api/payment/vnpay/create
{
  "code": "BOOKING123",
  "amount": 1000000
}

# 2. Kiểm tra response (phải có payUrl)
{
  "payUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=...",
  "txnRef": "BOOKING123-1733533200000"
}

# 3. Truy cập payUrl trong browser
# 4. Nếu lỗi 70 vẫn xuất hiện, kiểm tra logs server
```

---

## ✅ Danh Sách Kiểm Tra Cuối Cùng (CRITICAL)

**PHẦN MỀM (.env):**

- [x] **Tên biến: `VNP_HASHSECRET`** (không phải `VNP_HASH_SECRET`)
- [ ] Hash Secret trong `.env` chính xác với VNPay admin?
- [ ] TMN Code trong `.env` chính xác? (`F6PUGU6Q`)
- [ ] VNP_URL đúng? (`https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`)
- [ ] VNP_RETURN_URL được set? (`http://localhost:3000/payment/vnpay/return`)

**LOGIC XỬ LÝ:**

- [ ] `vnpay.controllers.js` dùng `VNP_HASHSECRET` khi tính hash?
- [ ] `payment.controller.js` dùng `VNP_HASHSECRET` khi verify?
- [ ] `buildSignData()` encode RFC 3986 đúng?
- [ ] Ngày tháng format đúng (yyyyMMddHHmmss)?
- [ ] Số tiền được nhân 100?
- [ ] Tất cả tham số được sort alphabetically?
- [ ] SHA512 hash được tính đúng?

**TESTING:**

- [ ] Chạy `node verify-vnpay-hash.js` để kiểm tra config?
- [ ] Xem logs khi test thanh toán?
- [ ] So sánh "VNPAY Sign String" từ logs?

---

## 🔍 Công Thức Tính Manual Hash (Để Verify)

Nếu muốn verify manual:

1. **Sắp xếp các tham số theo bảng chữ cái**
2. **Encode value theo RFC 3986** (space -> +, ! -> %21, etc.)
3. **Tạo chuỗi:** `key1=value1&key2=value2&...`
4. **Tính HMAC-SHA512** với secret key

### Ví Dụ Python:

```python
import hmac
import hashlib

params = {
    'vnp_Amount': '1000000',
    'vnp_Command': 'pay',
    'vnp_TmnCode': 'F6PUGU6Q',
    # ... các tham số khác
}

# Sắp xếp
sorted_params = sorted(params.items())

# Tạo chuỗi
sign_data = '&'.join([f'{k}={v}' for k, v in sorted_params])

# Tính hash
secret = 'I17W7L24RDVQ61ERF574Y6B6SCVZVJGD'
hash_result = hmac.new(
    secret.encode('utf-8'),
    sign_data.encode('utf-8'),
    hashlib.sha512
).hexdigest()

print(hash_result)  # So sánh với vnp_SecureHash trong log
```

---

## Nếu Vẫn Gặp Lỗi

1. **Liên hệ VNPay Support** với thông tin:

   - TMN Code
   - Timestamp của giao dịch lỗi
   - Error Code: 70

2. **Check VNPay Documentation:**

   - [VNPay Integration Guide](https://vnpayment.vn/documents/vnpay-payment-gateway.pdf)
   - [VNPay Sandbox](https://sandbox.vnpayment.vn)

3. **Trace Network:**
   - Mở DevTools (F12) → Network tab
   - Xem request được gửi đến VNPay có đúng không
   - So sánh với VNPay documentation

---

**Cập nhật:** 6/12/2025
**Phiên bản:** 1.0
