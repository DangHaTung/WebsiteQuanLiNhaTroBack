# Hướng dẫn Setup Ngrok cho IPN/Callback

## Tại sao cần Ngrok?

Payment Gateway (VNPay, MoMo, ZaloPay) cần gọi IPN/Callback từ server của họ về server của bạn. 
Trong môi trường development với localhost, Payment Gateway không thể gọi được.
Ngrok tạo một public URL (https://xxx.ngrok.io) để forward về localhost của bạn.

## Cài đặt Ngrok

### Cách 1: NPM (Khuyến nghị)
```bash
npm install -g ngrok
```

### Cách 2: Download trực tiếp
1. Truy cập: https://ngrok.com/download
2. Download và giải nén
3. Thêm vào PATH

## Đăng ký Ngrok Account (Miễn phí)

1. Truy cập: https://dashboard.ngrok.com/signup
2. Đăng ký account miễn phí
3. Lấy **Authtoken** từ dashboard
4. Set vào environment variable:
   ```bash
   export NGROK_AUTH_TOKEN=your_authtoken_here
   ```

**Lợi ích của ngrok account:**
- URL cố định (không đổi mỗi lần restart)
- Custom domain
- Nhiều tính năng hơn

## Cách sử dụng

### Option 1: Dùng script tự động (Khuyến nghị)

```bash
# Start ngrok và tự động lấy URL
node scripts/start-ngrok.js
```

Script sẽ:
- Tự động start ngrok
- Hiển thị các URL cần set vào .env
- Giữ ngrok chạy cho đến khi bạn Ctrl+C

### Option 2: Start ngrok thủ công

```bash
# Start ngrok
ngrok http 3000

# Hoặc với authtoken
ngrok http 3000 --authtoken YOUR_AUTH_TOKEN
```

Sau đó:
1. Mở http://127.0.0.1:4040 để xem ngrok dashboard
2. Copy URL (ví dụ: https://abc123.ngrok.io)
3. Set vào file `.env`:

```env
# MoMo IPN URL
MOMO_IPN_URL=https://abc123.ngrok.io/api/payment/momo/ipn

# ZaloPay Callback URL
ZALOPAY_CALLBACK_URL=https://abc123.ngrok.io/api/payment/zalopay/callback

# VNPay IPN URL (nếu cần)
# VNP_IPN_URL=https://abc123.ngrok.io/api/payment/vnpay/ipn
```

## Cấu trúc URL

Sau khi có ngrok URL (ví dụ: `https://abc123.ngrok.io`), các endpoint sẽ là:

- **MoMo IPN**: `https://abc123.ngrok.io/api/payment/momo/ipn`
- **ZaloPay Callback**: `https://abc123.ngrok.io/api/payment/zalopay/callback`
- **VNPay IPN**: `https://abc123.ngrok.io/api/payment/vnpay/ipn`

## Kiểm tra hoạt động

1. Start ngrok: `node scripts/start-ngrok.js`
2. Start backend server: `npm run dev`
3. Tạo payment và thanh toán
4. Kiểm tra logs:
   - Backend: Xem có log "🔔 ZaloPay Callback received" hoặc "✅ MoMo IPN raw"
   - Ngrok dashboard: Xem có request đến IPN endpoint

## Troubleshooting

### Ngrok không start được
- Kiểm tra port 3000 có đang được dùng không
- Kiểm tra ngrok đã cài đặt: `ngrok version`
- Kiểm tra authtoken (nếu dùng): `ngrok config check`

### IPN vẫn không được gọi
- Kiểm tra URL trong .env đúng chưa
- Kiểm tra ngrok đang chạy: Mở http://127.0.0.1:4040
- Kiểm tra backend server đang chạy trên port 3000
- Kiểm tra firewall không block ngrok

### URL thay đổi mỗi lần restart
- Đăng ký ngrok account và set NGROK_AUTH_TOKEN
- Hoặc dùng ngrok reserved domain (có phí)

## Lưu ý

1. **URL thay đổi**: Mỗi lần restart ngrok, URL sẽ thay đổi (trừ khi dùng ngrok account)
2. **Free tier giới hạn**: 
   - 1 tunnel cùng lúc
   - 40 connections/phút
   - URL thay đổi mỗi lần restart
3. **Production**: Không dùng ngrok trong production, dùng domain thật

## Next Steps

Sau khi setup ngrok:
1. Test thanh toán với MoMo/ZaloPay/VNPay
2. Kiểm tra IPN/Callback được gọi (xem logs)
3. Verify bill được cập nhật tự động

