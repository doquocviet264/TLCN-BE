# Gắn Leader Cho Tour - Hướng Dẫn

## Endpoint

```
PATCH /api/admin/tours/{id}/leader
```

## Phương Pháp

Hệ thống hỗ trợ **2 cách** gắn leader cho tour:

### Cách 1: Gắn theo `leaderId` (Khuyến nghị)

**Mục đích**: Lấy thông tin leader từ collection `tbl_leader`, tạo snapshot vào tour

**Yêu cầu**:

- `leaderId`: ObjectId của leader (từ collection tbl_leader)
- `note` (tùy chọn): Ghi chú bổ sung (VD: "Leader miền Bắc")

**Request**:

```bash
curl -X PATCH http://localhost:4000/api/admin/tours/67890abc123def456g789012/leader \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaderId": "12345abc123def456g789012",
    "note": "Leader miền Bắc"
  }'
```

**Response**:

```json
{
  "message": "Leader updated",
  "tour": {
    "_id": "67890abc123def456g789012",
    "title": "Du lịch Sapa 3 ngày",
    "leaderId": "12345abc123def456g789012",
    "leader": {
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0901234567",
      "note": "Leader miền Bắc"
    },
    ...
  }
}
```

**Ưu điểm**:

- ✅ Tự động lấy tên & SĐT từ profile Leader
- ✅ Khi leader update info, hệ thống có reference để lấy dữ liệu mới
- ✅ Dễ quản lý quyền (kiểm tra leaderId = req.user.id)

---

### Cách 2: Cập nhật Text Trực Tiếp

**Mục đích**: Update nhanh thông tin leader mà không thay đổi leaderId

**Yêu cầu**:

- `fullName`: Tên leader
- `phoneNumber`: Số điện thoại
- `note` (tùy chọn): Ghi chú

**Request**:

```bash
curl -X PATCH http://localhost:4000/api/admin/tours/67890abc123def456g789012/leader \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyễn Văn B",
    "phoneNumber": "0987654321",
    "note": "Hỗ trợ tuyến vịnh"
  }'
```

**Response**:

```json
{
  "message": "Leader updated",
  "tour": {
    "_id": "67890abc123def456g789012",
    "title": "Du lịch Sapa 3 ngày",
    "leaderId": null,
    "leader": {
      "fullName": "Nguyễn Văn B",
      "phoneNumber": "0987654321",
      "note": "Hỗ trợ tuyến vịnh"
    },
    ...
  }
}
```

**Ưu điểm**:

- ✅ Nhanh gọn, không cần ID leader
- ✅ Linh hoạt cho các trường hợp leader ad-hoc

---

## So Sánh

| Đặc điểm                   | Cách 1: leaderId              | Cách 2: Text                |
| -------------------------- | ----------------------------- | --------------------------- |
| **Yêu cầu**                | leaderId + note (opt)         | fullName + phoneNumber      |
| **leaderId field**         | Được gán ObjectId             | Null                        |
| **leader snapshot**        | Auto from Leader profile      | Manual từ body              |
| **Lưu trữ**                | Reference + snapshot          | Chỉ snapshot                |
| **Khi leader update info** | Có reference để track         | Không track được            |
| **Quản lý quyền**          | Dễ (check leaderId = user.id) | Phức tạp hơn                |
| **Trường hợp sử dụng**     | Team leader cố định           | Guide tạm thời, tour ad-hoc |

---

## Lỗi Thường Gặp

### 1. Invalid leaderId

```json
{
  "message": "Invalid leaderId"
}
```

→ Kiểm tra leaderId có phải ObjectId hợp lệ không (24 hex characters)

### 2. Leader not found

```json
{
  "message": "Leader not found"
}
```

→ LeaderId không tồn tại trong collection `tbl_leader`

### 3. Tour not found

```json
{
  "message": "Tour not found"
}
```

→ Tour ID không tồn tại

### 4. Thiếu tham số bắt buộc

```json
{
  "message": "Yêu cầu: (leaderId) hoặc (fullName + phoneNumber)"
}
```

→ Gửi đầy đủ tham số theo cách 1 hoặc cách 2

---

## Cách Lấy LeaderId

### Từ Swagger UI

1. Vào `http://localhost:4000/api-docs`
2. Tìm endpoint `GET /api/admin/leaders` (hoặc list leaders)
3. Chạy request, copy ObjectId từ response

### Từ MongoDB Compass

1. Kết nối database
2. Vào collection `tbl_leader`
3. Copy `_id` của leader cần gắn

### Từ Postman/curl

```bash
curl http://localhost:4000/api/admin/leaders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Ví Dụ Workflow

**Bước 1**: Lấy danh sách leader

```bash
curl http://localhost:4000/api/admin/leaders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Bước 2**: Copy leaderId (VD: `12345abc123def456g789012`)

**Bước 3**: Gắn vào tour

```bash
curl -X PATCH http://localhost:4000/api/admin/tours/67890abc123def456g789012/leader \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaderId": "12345abc123def456g789012",
    "note": "Leader miền Bắc"
  }'
```

---

## Schema Tour.leader

```javascript
leader: {
  fullName: String,      // Tên leader (required)
  phoneNumber: String,   // SĐT (required)
  note: String           // Ghi chú (optional, default "")
}
```

**Lưu ý**: `leader` là **embedded document** (không có `_id` riêng), không phải reference.

---

## Cập Nhật Leader Info Sau Này

Nếu leader update tên/SĐT trong profile:
- **Cách 1**: leaderId cố định → Gọi lại endpoint để re-snapshot dữ liệu mới
- **Cách 2**: Không có cách → Phải cập nhật thủ công bằng request mới

✅ **Khuyến nghị**: Sử dụng Cách 1 + Trigger re-snapshot khi leader update profile
