# ZaloPay: Callback vs Fallback

## Cách phân biệt

### 1. **Callback (IPN)** - Nguồn chân lý ✅
- **Khi nào**: ZaloPay tự động gọi server sau khi thanh toán thành công
- **Logs backend**: `🔔 ZaloPay Callback received`
- **Timing**: Ngay sau khi thanh toán, không cần user quay lại
- **Ưu điểm**: 
  - Tự động, không phụ thuộc vào user
  - Đảm bảo cập nhật trạng thái ngay cả khi user đóng trình duyệt
- **Nhược điểm**: 
  - Cần ngrok/public URL
  - Có thể bị chặn bởi firewall

### 2. **Return Handler (Fallback)** - Dự phòng
- **Khi nào**: User quay lại từ ZaloPay sau khi thanh toán
- **Logs backend**: `🔙 ZaloPay Return received`
- **Timing**: Khi user được redirect về từ ZaloPay
- **Ưu điểm**: 
  - Hoạt động ngay cả khi callback không được gọi
  - Không cần ngrok (nếu dùng localhost)
- **Nhược điểm**: 
  - Phụ thuộc vào user quay lại
  - Nếu user đóng trình duyệt, trạng thái không được cập nhật

## Cách kiểm tra đang dùng cái nào

### Kiểm tra logs backend:

```bash
# Tìm trong logs:
# 1. Nếu thấy "🔔 ZaloPay Callback received" → Đang dùng CALLBACK ✅
# 2. Nếu chỉ thấy "🔙 ZaloPay Return received" → Đang dùng FALLBACK
# 3. Nếu thấy cả 2 → Cả 2 đều hoạt động (tốt nhất)
```

### Kiểm tra payment metadata:

```javascript
// Trong database, kiểm tra payment.metadata:
// - Nếu có callbackData → Callback đã được gọi
// - Nếu có returnData → Return handler đã được gọi
// - Nếu có cả 2 → Cả 2 đều hoạt động
```

## Kết luận

**Nếu bạn thấy trạng thái được cập nhật:**
- Có thể là **Callback** (nếu thấy log "🔔 ZaloPay Callback received")
- Hoặc **Fallback** (nếu thấy log "🔙 ZaloPay Return received")
- Hoặc **Cả 2** (tốt nhất - đảm bảo cập nhật trong mọi trường hợp)

**Để đảm bảo:**
- Nên có cả 2 cơ chế hoạt động
- Callback là nguồn chân lý (tự động)
- Fallback là dự phòng (khi callback không hoạt động)

