# Hướng dẫn Debug ZaloPay Payment - Trạng thái không cập nhật

## Vấn đề
Thanh toán thành công nhưng trạng thái không được cập nhật.

## Nguyên nhân có thể

### 1. Callback không được gọi
- ZaloPay không thể gọi được callback URL (ngrok không hoạt động hoặc URL sai)
- Callback URL chưa được cấu hình trên dashboard

### 2. Return handler (fallback) không hoạt động
- Return handler có thể không được gọi
- Hoặc có lỗi trong quá trình xử lý

### 3. Lỗi trong quá trình xử lý
- MAC verification fail
- Payment không tìm thấy
- Lỗi khi apply payment

## Cách Debug

### Bước 1: Kiểm tra logs backend

Sau khi thanh toán, kiểm tra logs backend:

```bash
# Tìm các log sau:
# 1. Khi tạo order:
# "📤 Sending ZaloPay order"
# "📥 ZaloPay API Response"

# 2. Khi nhận callback:
# "🔔 ZaloPay Callback received"
# "📥 Raw callback body"
# "✅ ZaloPay payment SUCCESS"

# 3. Khi nhận return:
# "🔙 ZaloPay Return received"
# "✅ Payment applied successfully in return handler"
```

### Bước 2: Kiểm tra ngrok

```bash
# Kiểm tra ngrok đang chạy
curl http://localhost:4040/api/tunnels

# Hoặc mở: http://localhost:4040
# Xem URL hiện tại của ngrok
```

### Bước 3: Kiểm tra Payment trong database

Sử dụng script debug:

```bash
# Tìm transactionId từ logs hoặc database
# Ví dụ: 251126_123456

node scripts/debug-zalopay-payment.js 251126_123456
```

Script sẽ hiển thị:
- Payment status
- Bill status
- Callback data (nếu có)
- Return data (nếu có)

### Bước 4: Kiểm tra Callback URL trong .env

```bash
# Kiểm tra URL trong .env
grep ZALOPAY_CALLBACK_URL .env
```

Đảm bảo URL khớp với ngrok URL hiện tại.

### Bước 5: Test callback thủ công (nếu cần)

Nếu callback không được gọi, có thể test thủ công:

```bash
# Lấy callback data từ ZaloPay (nếu có)
# Sau đó gọi callback endpoint
curl -X POST https://your-ngrok-url.ngrok-free.dev/api/payment/zalopay/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "data={...}&mac=..."
```

## Giải pháp

### Giải pháp 1: Đảm bảo ngrok đang chạy

```bash
# Start ngrok
npm run ngrok
# Hoặc
node scripts/start-ngrok.js
```

### Giải pháp 2: Cập nhật Callback URL

```env
# Trong .env
ZALOPAY_CALLBACK_URL=https://your-current-ngrok-url.ngrok-free.dev/api/payment/zalopay/callback
```

### Giải pháp 3: Dựa vào Return Handler (Fallback)

Nếu callback không được gọi, return handler sẽ tự động apply payment khi user quay lại từ ZaloPay.

**Kiểm tra:**
- Sau khi thanh toán, user có được redirect về không?
- Logs có hiển thị "🔙 ZaloPay Return received" không?

### Giải pháp 4: Cấu hình trên ZaloPay Dashboard

Nếu vẫn không được, thử cấu hình callback URL trên dashboard:
1. Vào **Apps** → Click vào app của bạn
2. Tìm phần **Webhook** hoặc **Callback URL**
3. Nhập ngrok URL
4. Lưu lại

## Checklist Debug

- [ ] Ngrok đang chạy và URL đúng
- [ ] Callback URL trong .env khớp với ngrok URL
- [ ] Backend logs có hiển thị "🔔 ZaloPay Callback received"?
- [ ] Backend logs có hiển thị "🔙 ZaloPay Return received"?
- [ ] Payment status trong database là gì? (PENDING, SUCCESS, FAILED)
- [ ] Bill status trong database là gì? (UNPAID, PAID)
- [ ] Có lỗi nào trong logs không?

## Liên hệ hỗ trợ

Nếu vẫn không giải quyết được:
- **ZaloPay Support**: 1900 54 54 36
- **Email**: op@zalopay.vn

