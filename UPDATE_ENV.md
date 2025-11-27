# Cập nhật file .env với Ngrok URLs

## Thêm các dòng sau vào file `.env`:

```env
# MoMo IPN URL (thay YOUR_NGROK_URL bằng URL từ ngrok)
MOMO_IPN_URL=https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/momo/ipn

# ZaloPay Callback URL
ZALOPAY_CALLBACK_URL=https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/zalopay/callback

# VNPay IPN URL (nếu cần)
# VNP_IPN_URL=https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/vnpay/ipn
```

## Lưu ý:

1. **URL sẽ thay đổi** mỗi lần restart ngrok (trừ khi dùng ngrok account với reserved domain)
2. Sau khi thêm URL vào `.env`, **restart backend** để áp dụng
3. Để có URL cố định, đăng ký ngrok account và dùng reserved domain

## Vị trí thêm:

Thêm các dòng trên vào cuối file `.env`, sau dòng:
```
ZALOPAY_RETURN_URL=http://localhost:3000/api/payment/zalopay/return
```

