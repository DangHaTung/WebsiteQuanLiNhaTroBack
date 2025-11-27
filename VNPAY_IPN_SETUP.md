# Hướng dẫn Setup VNPay IPN

## Khác biệt với MoMo/ZaloPay

VNPay **không** gửi IPN URL trong payment request. Thay vào đó, bạn cần **config IPN URL trong VNPay merchant dashboard**.

## VNPay IPN - Yêu cầu

✅ **IPN URL phải có SSL (HTTPS)** - Ngrok URL đã đáp ứng yêu cầu này

✅ **Merchant cần cung cấp IPN URL cho VNPay** - VNPay KHÔNG tự gen IPN URL

✅ **Code đã xử lý IPN đúng**: Verify checksum, apply payment, trả về RspCode

## VNPay Sandbox - Quan trọng

⚠️ **VNPay Sandbox có thể KHÔNG hỗ trợ config IPN URL trong dashboard** như production.

### Cách kiểm tra và xử lý:

1. **Đăng nhập VNPay Sandbox Merchant Admin**:
   - URL: https://sandbox.vnpayment.vn/merchantv2/
   - Hoặc link trong email đăng ký sandbox
   - Đăng ký tại: https://sandbox.vnpayment.vn/devreg/

2. **Kiểm tra có mục cấu hình IPN không**:
   - Vào **Cấu hình** hoặc **Settings**
   - Tìm mục **IPN URL** hoặc **Instant Payment Notification URL**
   - Nếu **KHÔNG có** → Sandbox có thể không hỗ trợ config IPN

3. **Nếu Sandbox không hỗ trợ config IPN**:
   - VNPay Sandbox có thể **tự động gọi IPN** về URL mặc định
   - Hoặc chỉ dùng **Return URL** (fallback)
   - **Return URL vẫn hoạt động** và sẽ cập nhật bill

## Các bước setup

### Bước 1: Lấy Ngrok URL

Sau khi start ngrok, bạn sẽ có URL như:
```
https://imprudent-pneumatically-dylan.ngrok-free.dev
```

IPN URL sẽ là:
```
https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/vnpay/ipn
```

### Bước 2: Config IPN URL trong VNPay Merchant Dashboard

**Quan trọng**: VNPay **KHÔNG tự gen IPN URL**. Merchant **PHẢI cung cấp IPN URL** cho VNPay.

1. Đăng nhập vào VNPay merchant dashboard:
   - **Sandbox**: https://sandbox.vnpayment.vn/merchantv2/
   - **Production**: https://sandbox.vnpayment.vn/merchantv2/ (sau khi có tài khoản production)

2. Vào phần **Cấu hình** hoặc **Settings** hoặc **Thông tin website**

3. Tìm mục **IPN URL** hoặc **Instant Payment Notification URL** hoặc **URL nhận kết quả thanh toán**

4. Nhập IPN URL (phải là HTTPS):
   ```
   https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/vnpay/ipn
   ```

5. Lưu cấu hình

**Lưu ý**: 
- IPN URL **PHẢI có SSL (HTTPS)** ✅ (Ngrok đã đáp ứng)
- Nếu sandbox không có mục config IPN → Có thể không hỗ trợ, dùng Return URL làm fallback

### Bước 3: (Tùy chọn) Thêm vào .env để reference

Thêm vào file `.env`:
```env
# VNPay IPN URL (để reference, không dùng trong code)
VNP_IPN_URL=https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/vnpay/ipn
```

**Lưu ý**: Biến này chỉ để reference, VNPay sẽ tự động gọi IPN URL đã config trong dashboard.

## Kiểm tra

1. Tạo payment với VNPay
2. Thanh toán thành công
3. Kiểm tra logs backend xem có log "VNPay IPN" không
4. Kiểm tra bill status đã được cập nhật chưa

## Lưu ý

- VNPay IPN URL phải là **public URL** (không thể dùng localhost)
- Nếu dùng ngrok, URL sẽ thay đổi mỗi lần restart (trừ khi dùng ngrok account với reserved domain)
- Khi URL thay đổi, cần **update lại trong VNPay dashboard** (nếu có)
- **Sandbox có thể không hỗ trợ config IPN** → Dùng Return URL làm fallback (vẫn hoạt động tốt)

## Cách VNPay gọi IPN

VNPay sẽ gọi IPN URL với các tham số:
```
POST /api/payment/vnpay/ipn
?vnp_Amount=1000000
&vnp_BankCode=NCB
&vnp_BankTranNo=VNP14226112
&vnp_CardType=ATM
&vnp_OrderInfo=...
&vnp_PayDate=20231207170112
&vnp_ResponseCode=00
&vnp_TmnCode=CTTVNP01
&vnp_TransactionNo=14226112
&vnp_TransactionStatus=00
&vnp_TxnRef=166117
&vnp_SecureHash=...
```

Code đã xử lý:
- ✅ Verify checksum (vnp_SecureHash)
- ✅ Apply payment to bill
- ✅ Trả về RspCode và Message cho VNPay

## Giải pháp cho Sandbox

Nếu VNPay Sandbox không hỗ trợ config IPN URL:
1. **Return URL vẫn hoạt động** và sẽ cập nhật bill khi user quay lại
2. Logic hiện tại đã có fallback trong Return URL handler
3. Khi chuyển sang **production**, sẽ có dashboard đầy đủ để config IPN URL
4. **IPN URL đã sẵn sàng** - Chỉ cần VNPay gọi về là hoạt động

