# Hướng dẫn cấu hình ZaloPay IPN/Callback

## Bước 1: Kiểm tra code đã sẵn sàng

### ✅ Đã có sẵn:
1. **Callback Handler**: `src/controllers/paymentZalo.controller.js` - function `zaloCallback`
2. **Route**: `POST /api/payment/zalopay/callback` trong `src/routers/payment.route.js`
3. **Environment Variable**: `ZALOPAY_CALLBACK_URL` trong `.env`

### 📝 Callback URL hiện tại:
```
ZALOPAY_CALLBACK_URL=https://your-ngrok-url.ngrok-free.dev/api/payment/zalopay/callback
```

## Bước 2: Đăng nhập ZaloPay Merchant Dashboard

1. Truy cập: https://mc.zalopay.vn/dashboard
2. Đăng nhập với tài khoản merchant của bạn

## Bước 3: Cấu hình IPN/Callback URL

### Cách 1: Tìm trong Settings/Webhook
1. Vào **Cài đặt** (Settings) hoặc **Tích hợp** (Integration)
2. Tìm mục **Webhook URL** hoặc **Callback URL** hoặc **IPN URL**
3. Nhập URL: `https://your-ngrok-url.ngrok-free.dev/api/payment/zalopay/callback`
4. Lưu lại

### Cách 2: Tìm trong API Settings
1. Vào **API Settings** hoặc **Cấu hình API**
2. Tìm mục **Callback URL** hoặc **IPN URL**
3. Nhập URL callback
4. Lưu lại

### Cách 3: Nếu không tìm thấy trong dashboard
- ZaloPay có thể tự động sử dụng callback URL từ request khi tạo order
- URL được gửi trong field `callback_url` khi gọi API `create` order
- Code đã tự động gửi `callback_url` trong request (xem `paymentZalo.controller.js` dòng 146)

## Bước 4: Kiểm tra ngrok đang chạy

```bash
# Kiểm tra ngrok tunnel
curl http://localhost:4040/api/tunnels

# Hoặc mở browser: http://localhost:4040
```

Đảm bảo ngrok URL trong `.env` khớp với URL hiện tại của ngrok.

## Bước 5: Test IPN/Callback

1. **Tạo payment test:**
   - Tạo một order thanh toán ZaloPay
   - Hoàn tất thanh toán

2. **Kiểm tra logs backend:**
   ```bash
   # Tìm trong logs:
   # "🔔 ZaloPay Callback received"
   # "📥 Raw callback body"
   # "✅ ZaloPay payment SUCCESS"
   ```

3. **Kiểm tra database:**
   - Payment status có được update thành `SUCCESS` không?
   - Bill status có được update thành `PAID` không?

## Bước 6: Xử lý lỗi (nếu có)

### Lỗi: Callback không được gọi
- Kiểm tra ngrok có đang chạy không
- Kiểm tra URL trong `.env` có đúng không
- Kiểm tra firewall/network có chặn không

### Lỗi: Invalid MAC
- Kiểm tra `key2` trong code có đúng không
- So sánh với key2 trên dashboard

### Lỗi: Payment not found
- Kiểm tra `app_trans_id` có khớp với `transactionId` trong database không

## Lưu ý quan trọng

1. **Sandbox vs Production:**
   - Sandbox: Có thể không cần cấu hình trên dashboard, URL được gửi trong request
   - Production: Nên cấu hình trên dashboard để đảm bảo an toàn

2. **Ngrok URL thay đổi:**
   - Mỗi lần restart ngrok, URL có thể thay đổi
   - Cần update lại trong `.env` và trên dashboard (nếu có)

3. **Callback Format:**
   - ZaloPay gửi callback dạng `POST` với `application/x-www-form-urlencoded`
   - Body chứa: `data` (JSON string) và `mac` (signature)
   - Code đã xử lý đúng format này

## Tham khảo

- ZaloPay Developer Docs: https://developers.zalopay.vn
- ZaloPay Merchant Dashboard: https://mc.zalopay.vn/dashboard

