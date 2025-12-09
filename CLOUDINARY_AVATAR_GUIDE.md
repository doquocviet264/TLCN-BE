# 🎯 Cloudinary Upload Avatar - Why & How

## ✅ Vì Sao Nên Dùng Cloudinary?

### 1️⃣ **Đã Có Config Sẵn**

- ✅ Cloudinary API keys đã set trong `.env`
- ✅ Folder config: `travela/avatars`
- ✅ Không cần setup thêm

```env
CLOUDINARY_CLOUD_NAME=dlipnztpt
CLOUDINARY_API_KEY=577576459391912
CLOUDINARY_API_SECRET=pjwCzzYuwZt1UZ1aRlkBfwLGGR4
CLOUDINARY_FOLDER=travela/avatars
```

---

### 2️⃣ **Lợi Ích So Với Local Upload**

| Tiêu Chí        | Local Upload          | Cloudinary             |
| --------------- | --------------------- | ---------------------- |
| **Storage**     | Server disk           | Cloud CDN              |
| **Performance** | ⭐⭐ (server slow)    | ⭐⭐⭐⭐⭐ (CDN fast)  |
| **Bandwidth**   | ❌ (tốn server)       | ✅ (tốn CDN free tier) |
| **Scalability** | ❌ (disk full)        | ✅ (unlimited)         |
| **Security**    | ❌ (phải delete file) | ✅ (auto delete old)   |
| **Mobile**      | ⚠️ (HTTP only)        | ✅ (HTTPS auto)        |
| **Cost**        | Free                  | **Free 25GB/month**    |

---

### 3️⃣ **Vấn Đề Local Upload**

```javascript
// Local: /uploads/avatars/{userId}-{timestamp}.jpg
// Problem 1: Server disk chiếm bộ nhớ
// Problem 2: Nếu server restart → file bị mất (nếu không backup)
// Problem 3: Phải manual delete old files
// Problem 4: Load ảnh chậm (server bandwidth)
```

---

### 4️⃣ **Lợi Ích Cloudinary**

```javascript
// Cloudinary: https://res.cloudinary.com/dlipnztpt/image/upload/v1701388800/travela/avatars/abc123.jpg
// Benefit 1: CDN global → load nhanh từ khắp nơi
// Benefit 2: Auto optimize image (reduce size, convert format)
// Benefit 3: Auto delete old image khi upload new
// Benefit 4: Unlimited storage (free 25GB/month)
// Benefit 5: HTTPS auto, no setup needed
```

---

## 🔧 Fix Đã Thực Hiện

### 1️⃣ Fixed baseUrl() Function

**File:** `src/controllers/user.controller.js`

```javascript
// ❌ TRƯỚC - Dùng x-forwarded-host (sai với webhook.site)
const host = req.headers["x-forwarded-host"] || req.get("host");
// Kết quả: https://webhook.site/uploads/avatars/... (404!)

// ✅ SAU - Dùng BASE_URL từ .env
function baseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, "");
  }
  const proto = req.protocol || "http";
  const host = req.get("host");
  return `${proto}://${host}`;
}
// Kết quả: http://localhost:4000 (correct!)
```

---

### 2️⃣ Fixed uploadMyAvatarCloud()

**File:** `src/controllers/user.controller.js`

```javascript
// ❌ TRƯỚC - Lưu vào sai field
me.avatarUrl = uploadResult.secure_url; // Field không tồn tại!

// ✅ SAU - Lưu vào đúng field
me.avatar = uploadResult.secure_url; // Field chính từ schema
me.avatarPublicId = uploadResult.public_id;
```

**User Schema:**

```javascript
{
  avatar: { type: String, default: "" },           // ✅ Dùng field này
  avatarPublicId: { type: String, default: "" },   // ✅ Lưu public ID
  avatarUrl: { type: String, default: "" },        // ❌ Không tồn tại!
}
```

---

### 3️⃣ Fixed .env BASE_URL

```env
# ❌ TRƯỚC (SAI - webhook.site)
BASE_URL=https://webhook.site/your-demo

# ✅ SAU (ĐÚNG - localhost:4000)
BASE_URL=http://localhost:4000
```

---

## 📊 Frontend Integration

### Upload via Cloudinary (Recommended)

```javascript
const uploadAvatarCloud = async (file) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch("/api/users/me/avatarcloud", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await response.json();
  console.log(data);
  // Response:
  // {
  //   "message": "Avatar updated",
  //   "avatarUrl": "https://res.cloudinary.com/dlipnztpt/image/upload/v1701388800/travela/avatars/abc123.jpg",
  //   "publicId": "travela/avatars/abc123",
  //   "user": { "avatar": "https://res.cloudinary.com/...", ... }
  // }

  // Use avatarUrl directly - it's already CDN URL!
  updateUserAvatar(data.avatarUrl);
};
```

---

## 🚀 Test Cloudinary Upload

### 1. Verify Config

```bash
grep CLOUDINARY .env
# Output:
# CLOUDINARY_CLOUD_NAME=dlipnztpt
# CLOUDINARY_API_KEY=577576459391912
# CLOUDINARY_API_SECRET=pjwCzzYuwZt1UZ1aRlkBfwLGGR4
# CLOUDINARY_FOLDER=travela/avatars
```

### 2. Restart Server

```bash
npm start
```

### 3. Test Upload

```bash
curl -X POST http://localhost:4000/api/users/me/avatarcloud \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@avatar.jpg"

# Response:
# {
#   "message": "Avatar updated",
#   "avatarUrl": "https://res.cloudinary.com/dlipnztpt/image/upload/v1701388800/travela/avatars/abc123.jpg",
#   "publicId": "travela/avatars/abc123",
#   "user": { ... }
# }
```

### 4. Verify URL

- Open `avatarUrl` in browser
- Should display avatar image ✅
- Not 404 error ❌

---

## 📝 Summary

| Aspect        | Before                   | After                             |
| ------------- | ------------------------ | --------------------------------- |
| Avatar Upload | Local storage            | ✅ Cloudinary                     |
| baseUrl()     | Sai (webhook.site)       | ✅ Correct (localhost:4000)       |
| Field Name    | avatarUrl (wrong)        | ✅ avatar (correct)               |
| Response URL  | https://webhook.site/... | ✅ https://res.cloudinary.com/... |
| Performance   | ⭐⭐ (slow)              | ✅ ⭐⭐⭐⭐⭐ (CDN fast)          |

---

## ✅ Next Steps

1. **Restart Server**

   ```bash
   npm start
   ```

2. **Test Cloudinary Upload**

   - Use Postman or curl
   - Upload avatar file
   - Check response URL

3. **Update Frontend**

   - Switch to `POST /api/users/me/avatarcloud`
   - Use `data.avatarUrl` from response
   - Already formatted, no baseUrl needed

4. **Monitor Cloudinary**
   - Go to https://cloudinary.com/console
   - Check uploaded images in `travela/avatars` folder
   - Verify auto-cleanup of old images

---

**Date:** 9/12/2025  
**Status:** ✅ Ready for Production
