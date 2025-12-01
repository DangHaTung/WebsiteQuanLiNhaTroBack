# 📬 HỆ THỐNG THÔNG BÁO (NOTIFICATION SYSTEM)

## 📋 Tổng quan

Hệ thống thông báo real-time sử dụng Socket.IO để gửi thông báo tức thời cho người dùng khi có sự kiện quan trọng xảy ra (tạo hóa đơn, thanh toán, ký hợp đồng, etc.)

---

## 🏗️ Kiến trúc

### 1. **Database Model** (`notification.model.js`)
- Lưu trữ tất cả thông báo trong MongoDB
- Hỗ trợ đánh dấu đã đọc/chưa đọc
- Có metadata để lưu thông tin bổ sung
- Có actionUrl để navigate khi click

### 2. **Notification Service** (`notification.service.js`)
- Tạo thông báo mới
- Gửi real-time qua Socket.IO
- Quản lý thông báo (đọc, xóa, lấy danh sách)
- Helper methods cho các case cụ thể

### 3. **Notification Controller** (`notification.controller.js`)
- API endpoints để frontend gọi
- Xử lý request/response

### 4. **Routes** (`notificationCRUD.route.js`)
- Định nghĩa các API endpoints

---

## 📡 API Endpoints

### **GET /api/notifications-crud**
Lấy danh sách thông báo của user hiện tại

**Query params:**
- `page` (number): Trang hiện tại (default: 1)
- `limit` (number): Số lượng mỗi trang (default: 20)
- `isRead` (boolean): Lọc theo trạng thái đã đọc (true/false)
- `type` (string): Lọc theo loại thông báo

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": "...",
      "type": "BILL_CREATED",
      "title": "Hóa đơn hàng tháng mới",
      "message": "Bạn có hóa đơn mới: 3,000,000₫ - Tháng 12/2025",
      "isRead": false,
      "priority": "HIGH",
      "actionUrl": "/invoices/...",
      "metadata": { ... },
      "createdAt": "2025-12-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### **GET /api/notifications-crud/unread-count**
Đếm số thông báo chưa đọc

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

### **PUT /api/notifications-crud/:id/read**
Đánh dấu một thông báo đã đọc

**Response:**
```json
{
  "success": true,
  "message": "Đã đánh dấu thông báo đã đọc",
  "data": { ... }
}
```

---

### **PUT /api/notifications-crud/read-all**
Đánh dấu tất cả thông báo đã đọc

**Response:**
```json
{
  "success": true,
  "message": "Đã đánh dấu tất cả thông báo đã đọc",
  "data": {
    "modifiedCount": 5
  }
}
```

---

### **DELETE /api/notifications-crud/:id**
Xóa một thông báo

**Response:**
```json
{
  "success": true,
  "message": "Đã xóa thông báo"
}
```

---

### **DELETE /api/notifications-crud/read-all**
Xóa tất cả thông báo đã đọc

**Response:**
```json
{
  "success": true,
  "message": "Đã xóa tất cả thông báo đã đọc",
  "data": {
    "deletedCount": 10
  }
}
```

---

### **POST /api/notifications-crud/test** (Admin only)
Test tạo thông báo

**Body:**
```json
{
  "userId": "user_id_here",
  "type": "BILL_CREATED",
  "title": "Test notification",
  "message": "This is a test message",
  "priority": "HIGH"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã tạo thông báo test",
  "data": { ... }
}
```

---

## 🔔 Loại thông báo (Notification Types)

| Type | Mô tả | Priority |
|------|-------|----------|
| `BILL_CREATED` | Tạo hóa đơn mới | HIGH |
| `BILL_DUE_SOON` | Hóa đơn sắp đến hạn | HIGH |
| `PAYMENT_SUCCESS` | Thanh toán thành công | MEDIUM |
| `PAYMENT_FAILED` | Thanh toán thất bại | HIGH |
| `CONTRACT_SIGNED` | Ký hợp đồng | MEDIUM |
| `CONTRACT_EXPIRING` | Hợp đồng sắp hết hạn | HIGH |
| `RECEIPT_CREATED` | Tạo phiếu thu | HIGH |
| `SYSTEM` | Thông báo hệ thống | MEDIUM |

---

## 🔌 Socket.IO Events

### **Client → Server**
- `ping`: Kiểm tra kết nối
- (Không cần gửi gì, server tự động gửi khi có notification mới)

### **Server → Client**
- `connected`: Khi kết nối thành công
- `new-notification`: Khi có thông báo mới
- `pong`: Response cho ping

**Event `new-notification` payload:**
```javascript
{
  notification: {
    _id: "...",
    type: "BILL_CREATED",
    title: "Hóa đơn hàng tháng mới",
    message: "Bạn có hóa đơn mới: 3,000,000₫",
    priority: "HIGH",
    metadata: { ... },
    actionUrl: "/invoices/...",
    createdAt: "2025-12-01T10:00:00.000Z"
  }
}
```

---

## 💻 Cách sử dụng trong Code

### **Backend - Tạo thông báo khi tạo hóa đơn**

```javascript
import notificationService from '../services/notification/notification.service.js';

// Trong bill controller, sau khi tạo bill
const bill = await Bill.create({ ... });

// Gửi thông báo
await notificationService.notifyBillCreated(bill);
```

### **Backend - Tạo thông báo custom**

```javascript
await notificationService.createNotification({
  userId: user._id,
  type: 'BILL_CREATED',
  title: 'Hóa đơn mới',
  message: 'Bạn có hóa đơn mới cần thanh toán',
  relatedEntity: 'BILL',
  relatedEntityId: bill._id,
  priority: 'HIGH',
  actionUrl: `/invoices/${bill._id}`,
  metadata: {
    amount: bill.transfer,
    month: bill.month,
  },
});
```

---

## 🧪 Testing với Postman

### **1. Test tạo thông báo**

```
POST http://localhost:3000/api/notifications-crud/test
Headers:
  Authorization: Bearer <admin_token>
Body:
{
  "userId": "user_id_here",
  "type": "BILL_CREATED",
  "title": "Test Hóa đơn mới",
  "message": "Đây là thông báo test",
  "priority": "HIGH"
}
```

### **2. Lấy danh sách thông báo**

```
GET http://localhost:3000/api/notifications-crud?page=1&limit=10
Headers:
  Authorization: Bearer <user_token>
```

### **3. Đếm thông báo chưa đọc**

```
GET http://localhost:3000/api/notifications-crud/unread-count
Headers:
  Authorization: Bearer <user_token>
```

### **4. Đánh dấu đã đọc**

```
PUT http://localhost:3000/api/notifications-crud/<notification_id>/read
Headers:
  Authorization: Bearer <user_token>
```

---

## 🎯 Next Steps (Phase 2)

1. ✅ Tích hợp vào Bill Controller (khi tạo hóa đơn)
2. ✅ Tích hợp vào Payment Controller (khi thanh toán)
3. ✅ Tích hợp vào Contract Controller (khi ký hợp đồng)
4. ⏳ Frontend Socket Context
5. ⏳ Frontend Notification UI Components

---

## 📝 Notes

- Thông báo được lưu vào database để user có thể xem lại
- Real-time notification qua Socket.IO (nếu user đang online)
- Nếu user offline, thông báo vẫn được lưu và hiển thị khi login lại
- Có thể tích hợp thêm email notification nếu cần

---

## 🐛 Troubleshooting

**Không nhận được thông báo real-time?**
- Kiểm tra Socket.IO đã kết nối chưa
- Kiểm tra user đã authenticate chưa
- Kiểm tra console log backend

**Thông báo không được tạo?**
- Kiểm tra userId có đúng không
- Kiểm tra required fields (type, title, message)
- Xem console log backend để debug

---

**Created by:** Kiro AI Assistant
**Date:** December 1, 2025
**Version:** 1.0.0
