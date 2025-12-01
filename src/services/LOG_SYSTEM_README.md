# 📝 HỆ THỐNG LOG - HƯỚNG DẪN SỬ DỤNG

## 🎯 **TỔNG QUAN**

Hệ thống log tự động ghi lại các hành động quan trọng trong ứng dụng để admin có thể theo dõi lịch sử thay đổi.

---

## 📦 **CÁC THÀNH PHẦN**

### **Backend:**
1. **`log.model.js`** - Model MongoDB cho logs
2. **`log.service.js`** - Service helper để ghi log dễ dàng
3. **`log.controller.js`** - Controller xử lý API logs
4. **`log.route.js`** - Routes cho logs API
5. **`log.validation.js`** - Validation schemas

### **Frontend:**
1. **`log.ts`** - Service gọi API logs
2. **`Logs.tsx`** - Trang quản lý logs (chỉ ADMIN)

---

## 🚀 **CÁCH SỬ DỤNG**

### **1. Ghi Log trong Controller**

```javascript
import logService from '../services/log.service.js';

// ✅ Log khi tạo mới
await logService.logCreate({
  entity: 'ROOM',
  entityId: room._id,
  actorId: req.user._id,
  data: {
    roomNumber: room.roomNumber,
    type: room.type,
    pricePerMonth: room.pricePerMonth,
  },
});

// ✅ Log khi cập nhật
await logService.logUpdate({
  entity: 'ROOM',
  entityId: room._id,
  actorId: req.user._id,
  before: {
    status: oldRoom.status,
    pricePerMonth: oldRoom.pricePerMonth,
  },
  after: {
    status: newRoom.status,
    pricePerMonth: newRoom.pricePerMonth,
  },
});

// ✅ Log khi xóa
await logService.logDelete({
  entity: 'ROOM',
  entityId: room._id,
  actorId: req.user._id,
  data: {
    roomNumber: room.roomNumber,
    deletedAt: new Date(),
  },
});

// ✅ Log khi thanh toán
await logService.logPayment({
  entity: 'BILL',
  entityId: bill._id,
  actorId: req.user?._id,
  amount: 5000000,
  provider: 'VNPAY',
  status: 'SUCCESS',
});

// ✅ Log tùy chỉnh
await logService.info({
  entity: 'CONTRACT',
  entityId: contract._id,
  actorId: req.user._id,
  message: 'Ký hợp đồng thành công',
  diff: {
    signedAt: new Date(),
    signedBy: req.user.fullName,
  },
});
```

---

## 📊 **CÁC LOẠI LOG**

### **Entities:**
- `ROOM` - Phòng
- `CONTRACT` - Hợp đồng
- `BILL` - Hóa đơn
- `USER` - Người dùng
- `CHECKIN` - Checkin
- `FINALCONTRACT` - Hợp đồng chính thức
- `PAYMENT` - Thanh toán

### **Levels:**
- `INFO` - Thông tin (màu xanh)
- `WARN` - Cảnh báo (màu vàng)
- `ERROR` - Lỗi (màu đỏ)

---

## 🎨 **FRONTEND - TRANG LOGS**

### **Truy cập:**
- URL: `http://localhost:5173/admin/logs`
- Quyền: Chỉ ADMIN

### **Tính năng:**
- ✅ Xem danh sách logs với pagination
- ✅ Filter theo level, entity, date range
- ✅ Thống kê: Total, Info, Warnings, Errors
- ✅ Xem chi tiết log (diff before/after)
- ✅ Xóa logs cũ (cleanup)

---

## 🔧 **API ENDPOINTS**

### **GET /api/logs**
Lấy danh sách logs

**Query params:**
- `page` - Trang (default: 1)
- `limit` - Số lượng/trang (default: 10)
- `level` - Filter theo level (INFO, WARN, ERROR)
- `entity` - Filter theo entity
- `actorId` - Filter theo user
- `startDate` - Từ ngày (ISO format)
- `endDate` - Đến ngày (ISO format)

**Example:**
```
GET /api/logs?level=ERROR&entity=BILL&page=1&limit=20
```

### **GET /api/logs/stats**
Lấy thống kê logs

**Query params:**
- `startDate` - Từ ngày
- `endDate` - Đến ngày
- `groupBy` - Group theo (level, entity, actor)

### **GET /api/logs/entity/:entity/:entityId**
Lấy logs của một entity cụ thể

**Example:**
```
GET /api/logs/entity/ROOM/507f1f77bcf86cd799439011
```

### **GET /api/logs/cleanup**
Xóa logs cũ

**Query params:**
- `days` - Xóa logs cũ hơn X ngày (default: 30)
- `level` - Chỉ xóa logs có level này

---

## 📝 **ĐÃ TÍCH HỢP LOG VÀO:**

### **✅ Payment Controller:**
- Log khi thanh toán thành công (VNPay, Momo, ZaloPay)
- Log cả transaction mode và fallback mode

### **✅ Bill Controller:**
- Log khi tạo bill mới
- Log khi xác nhận thanh toán tiền mặt

### **✅ Room Controller:**
- Log khi tạo phòng mới
- Log khi cập nhật phòng (status, giá, etc.)

### **✅ User Controller:**
- Log khi tạo user mới

---

## 🎯 **ROADMAP TIẾP THEO**

### **Phase 1: Hoàn thiện tích hợp** ✅
- [x] Payment logs
- [x] Bill logs
- [x] Room logs
- [x] User logs
- [ ] Contract logs
- [ ] Checkin logs
- [ ] FinalContract logs

### **Phase 2: Tính năng nâng cao**
- [ ] Tab "Lịch sử" trong Room/Bill/Contract detail
- [ ] Export logs ra CSV/Excel
- [ ] Real-time logs (WebSocket)
- [ ] Alert system (email khi có ERROR)
- [ ] Audit trail (rollback changes)

---

## 💡 **BEST PRACTICES**

### **1. Luôn ghi log cho các action quan trọng:**
- ✅ Tạo/sửa/xóa dữ liệu
- ✅ Thanh toán
- ✅ Thay đổi trạng thái quan trọng

### **2. Không ghi log cho:**
- ❌ GET requests (đọc dữ liệu)
- ❌ Validation errors
- ❌ Authentication checks

### **3. Sử dụng đúng level:**
- `INFO` - Hành động bình thường
- `WARN` - Hành động cần chú ý (xóa, hủy)
- `ERROR` - Lỗi hệ thống

### **4. Lưu thông tin hữu ích trong diff:**
```javascript
// ✅ GOOD
diff: {
  action: 'UPDATE',
  before: { status: 'AVAILABLE', price: 5000000 },
  after: { status: 'OCCUPIED', price: 5500000 }
}

// ❌ BAD
diff: { changed: true }
```

---

## 🐛 **TROUBLESHOOTING**

### **Log không được tạo:**
1. Kiểm tra import `logService`
2. Kiểm tra entity name (phải đúng enum)
3. Kiểm tra entityId (phải là ObjectId hợp lệ)

### **Frontend không hiển thị logs:**
1. Kiểm tra quyền ADMIN
2. Kiểm tra route `/admin/logs` đã được thêm
3. Kiểm tra API endpoint `/api/logs`

### **Performance issues:**
1. Sử dụng TTL index (logs tự động xóa sau 180 ngày)
2. Cleanup logs cũ định kỳ
3. Limit số lượng logs query

---

## 📞 **HỖ TRỢ**

Nếu có vấn đề, kiểm tra:
1. Console logs (backend)
2. Network tab (frontend)
3. MongoDB logs collection

---

**Tạo bởi:** Kiro AI Assistant
**Ngày:** 2024
**Version:** 1.0.0
