# 🎯 Avatar Management Endpoints - Complete Guide

## 📋 Overview

Hệ thống có **3 endpoint** để quản lý avatar:

1. **Update Profile (JSON)** - Cập nhật avatar URL trực tiếp
2. **Upload Avatar (Local)** - Upload lên /uploads/avatars
3. **Upload Avatar (Cloudinary)** - Upload lên Cloudinary CDN

---

## 🔌 Các Endpoint

### 1️⃣ **Update Profile Avatar (PUT)**

**Endpoint:**

```
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**

```json
{
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response:**

```json
{
  "message": "Profile updated",
  "user": {
    "_id": "user123",
    "fullName": "Nguyen Van A",
    "email": "email@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "avatarPublicId": "",
    "phoneNumber": "0912345678",
    "address": "Ha Noi",
    "username": "nguyenvana",
    "role": "user",
    "createdAt": "2023-12-01T10:00:00Z"
  }
}
```

**Validation:**

- avatar phải là URL hợp lệ
- Các field khác (fullName, phoneNumber, address, username) cũng có thể update

**Use Case:** Update avatar URL từ Google Login, hoặc URL ảnh từ service khác

---

### 2️⃣ **Upload Avatar (Local Storage)**

**Endpoint:**

```
POST /api/users/me/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request (FormData):**

```
avatar: <file> (image/png, image/jpg, image/jpeg, image/webp)
```

**Response:**

```json
{
  "message": "Avatar updated",
  "avatarPath": "/uploads/avatars/user123-1701388800000.jpg",
  "avatarUrl": "http://localhost:4000/uploads/avatars/user123-1701388800000.jpg",
  "user": {
    "_id": "user123",
    "avatar": "/uploads/avatars/user123-1701388800000.jpg",
    "avatarPublicId": ""
    // ... other user fields
  }
}
```

**File Handling:**

- Upload thư mục: `uploads/avatars/`
- File naming: `{userId}-{timestamp}.{ext}`
- Tự động xóa avatar cũ nếu trong `/uploads/avatars/`
- Max file size: 2MB

**Supported Formats:**

- image/png (.png)
- image/jpeg (.jpg, .jpeg)
- image/webp (.webp)

**Use Case:** Upload ảnh từ thiết bị (Web, Mobile)

---

### 3️⃣ **Upload Avatar (Cloudinary)**

**Endpoint:**

```
POST /api/users/me/avatarcloud
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request (FormData):**

```
avatar: <file> (image/png, image/jpg, image/jpeg, image/webp)
```

**Response:**

```json
{
  "message": "Avatar updated",
  "avatarUrl": "https://res.cloudinary.com/dlipnztpt/image/upload/v1701388800/travela/avatars/abc123.jpg",
  "publicId": "travela/avatars/abc123",
  "user": {
    "_id": "user123",
    "avatar": "",
    "avatarPublicId": "travela/avatars/abc123",
    "avatarUrl": "https://res.cloudinary.com/dlipnztpt/image/upload/v1701388800/travela/avatars/abc123.jpg"
    // ... other user fields
  }
}
```

**Cloud Storage:**

- Upload to Cloudinary
- Folder: `travela/avatars/`
- Automatic cleanup: Xóa ảnh cũ nếu có publicId
- Unlimited file size (Cloudinary limit: 100MB)

**Configuration (.env):**

```env
CLOUDINARY_CLOUD_NAME=dlipnztpt
CLOUDINARY_API_KEY=577576459391912
CLOUDINARY_API_SECRET=pjwCzzYuwZt1UZ1aRlkBfwLGGR4
CLOUDINARY_FOLDER=travela/avatars
```

**Use Case:** Sử dụng CDN cho performance tốt hơn

---

## 📊 Data Model - User Schema

```javascript
{
  // ... other fields
  avatar: {
    type: String,
    default: "",
    // Có thể là:
    // 1. "" (empty)
    // 2. "/uploads/avatars/user123-1701388800000.jpg" (local)
    // 3. "https://res.cloudinary.com/..." (Cloudinary)
    // 4. "https://example.com/avatar.jpg" (external URL)
  },
  avatarPublicId: {
    type: String,
    default: "",
    // Chỉ dùng khi upload via Cloudinary
    // Format: "travela/avatars/abc123"
  }
}
```

---

## 🔄 Flow Chuyển Endpoint

### Scenario 1: User Google Login → Lấy avatar từ Google

```
1. Google Login trả về user data + avatar
2. Backend lưu vào user.avatar (URL)
3. FE hiển thị user.avatar trực tiếp
4. Không cần upload file
```

### Scenario 2: User Upload ảnh từ thiết bị → Local Storage

```
1. FE select file + submit multipart/form-data
2. Backend POST /api/users/me/avatar
3. Multer save file vào /uploads/avatars/
4. Backend trả về avatarUrl: "http://localhost:4000/uploads/avatars/..."
5. FE hiển thị avatarUrl
```

### Scenario 3: User Upload ảnh từ thiết bị → Cloudinary

```
1. FE select file + submit multipart/form-data
2. Backend POST /api/users/me/avatarcloud
3. Multer buffer file vào memory
4. Backend upload buffer to Cloudinary
5. Backend trả về avatarUrl: "https://res.cloudinary.com/..."
6. FE hiển thị avatarUrl
```

### Scenario 4: User Update avatar URL trực tiếp

```
1. FE input URL từ bên ngoài
2. FE PUT /api/users/me { avatar: "https://..." }
3. Backend validate URL + save
4. FE hiển thị URL mới
```

---

## 🎨 Frontend Integration

### Option A: Use Local Upload

```javascript
const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch("/api/users/me/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await response.json();
  // Dùng data.avatarUrl hoặc data.user.avatar
  updateUserAvatar(data.avatarUrl);
};
```

### Option B: Use Cloudinary Upload

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
  // Dùng data.avatarUrl
  updateUserAvatar(data.avatarUrl);
};
```

### Option C: Update URL Trực Tiếp

```javascript
const updateAvatarUrl = async (avatarUrl) => {
  const response = await fetch("/api/users/me", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ avatar: avatarUrl }),
  });

  const data = await response.json();
  updateUserAvatar(data.user.avatar);
};
```

---

## ✅ Response Fields Summary

| Field        | Endpoint          | Type   | Description                     |
| ------------ | ----------------- | ------ | ------------------------------- |
| `message`    | All               | String | Thông báo thành công            |
| `avatar`     | PUT /me           | String | Avatar URL (JSON path)          |
| `avatarPath` | POST /avatar      | String | Local path only                 |
| `avatarUrl`  | POST /avatar      | String | Full URL (localhost:4000)       |
| `avatarUrl`  | POST /avatarcloud | String | CDN URL (cloudinary)            |
| `publicId`   | POST /avatarcloud | String | Cloudinary public ID            |
| `user`       | All               | Object | Full user object (trừ password) |

---

## 🔒 Security & Validation

### File Upload Validation

- ✅ File type: image/png, image/jpg, image/jpeg, image/webp
- ✅ Max file size: 2MB
- ✅ Authentication required: Bearer token

### URL Validation (PUT /me)

- ✅ Avatar field phải là valid URL nếu có

### Access Control

- ✅ Chỉ user được update avatar của chính mình
- ✅ Cloudinary folder: `travela/avatars/` (restricted)

---

## 📝 API Documentation

Tất cả endpoints có OpenAPI/Swagger documentation:

```javascript
/**
 * @openapi
 * /api/users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload avatar cho user hiện tại
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 */
```

---

## 🚀 Deployment Notes

### Local Upload (Development)

- Thích hợp cho dev/testing
- Ảnh lưu cục bộ: `uploads/avatars/`
- Cần setup static file serving
- Performance: ✅ (nhanh)

### Cloudinary (Production)

- Thích hợp cho production
- Ảnh lưu trên CDN
- Performance: ⭐⭐⭐ (very fast)
- Cost: Free tier 25GB/month

---

**Created:** 9/12/2025  
**Status:** ✅ Complete Implementation
