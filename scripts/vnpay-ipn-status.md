# VNPay IPN Status Check

## ✅ Đã được cấu hình và sử dụng

### 1. IPN Route đã được setup
**File:** `src/routers/payment.route.js`
```javascript
router.post(
  "/vnpay/ipn",
  express.urlencoded({ extended: false }),
  paymentController.vnpayIPN
);
```
✅ Route: `POST /api/payment/vnpay/ipn`

### 2. IPN Handler đã được implement
**File:** `src/controllers/payment.controller.js`
- Function: `vnpayIPN`
- Xử lý:
  - ✅ Verify checksum/signature
  - ✅ Tìm/tạo Payment record
  - ✅ Apply payment nếu `vnp_ResponseCode === "00"`
  - ✅ Trả response đúng format cho VNPay

### 3. IPN URL đã được cấu hình
**File:** `.env`
```
VNP_IPN_URL=https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/vnpay/ipn
```

### 4. IPN Handler Logic
```javascript
export const vnpayIPN = async (req, res) => {
    // 1. Verify checksum
    const verify = vnpayService.verifyVnPayResponse(params);
    if (!verify.valid) {
        return res.json({ RspCode: "97", Message: "Invalid checksum" });
    }

    // 2. Tìm Payment theo transactionId
    let payment = await Payment.findOne({ provider: "VNPAY", transactionId: txnRef });

    // 3. Nếu chưa có, tạo mới từ orderInfo
    if (!payment) {
        const billId = parseFromOrderInfo(params.vnp_OrderInfo);
        payment = await Payment.create({ ... });
    }

    // 4. Idempotency check
    if (payment.status === "SUCCESS") {
        return res.json({ RspCode: "00", Message: "Already processed" });
    }

    // 5. Apply payment nếu thành công
    if (rspCode === "00") {
        await applyPaymentToBill(payment, params);
        return res.json({ RspCode: "00", Message: "Confirm Success" });
    }
}
```

## 📝 Lưu ý quan trọng

### VNPay IPN URL được cấu hình ở đâu?
- **Trên VNPay Merchant Dashboard** (không phải trong code)
- IPN URL phải được đăng ký trên dashboard của VNPay
- Code chỉ cần có route và handler để nhận IPN

### IPN URL trong .env
- `VNP_IPN_URL` trong `.env` chỉ để reference/documentation
- VNPay sẽ gọi IPN URL đã được cấu hình trên dashboard
- Đảm bảo IPN URL trên dashboard khớp với route trong code

### Response Format
VNPay IPN handler trả về đúng format:
```json
{
  "RspCode": "00",  // 00 = Success, 97 = Invalid checksum, 99 = Internal error
  "Message": "Confirm Success"
}
```

## ✅ Kết luận

**VNPay IPN đã được cấu hình và sử dụng đúng cách:**
1. ✅ Route đã được setup
2. ✅ Handler đã được implement với đầy đủ logic
3. ✅ IPN URL đã được cấu hình trên VNPay dashboard (theo user)
4. ✅ Code sẵn sàng nhận và xử lý IPN từ VNPay

## 🔍 Cách kiểm tra IPN hoạt động

1. **Test thanh toán:**
   - Tạo payment với VNPay
   - Hoàn tất thanh toán
   - Kiểm tra backend logs xem có nhận IPN không

2. **Kiểm tra logs:**
   ```bash
   # Xem logs backend
   # Tìm: "VNPay IPN" hoặc "vnpayIPN"
   ```

3. **Kiểm tra database:**
   - Payment status có được update thành `SUCCESS` không?
   - Bill status có được update thành `PAID` không?

4. **Kiểm tra VNPay Dashboard:**
   - Xem transaction logs
   - Xem IPN call history
   - Xem IPN response status

## 🚨 Nếu IPN không hoạt động

1. **Kiểm tra IPN URL trên VNPay Dashboard:**
   - Đảm bảo URL đúng: `https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/vnpay/ipn`
   - Đảm bảo URL accessible từ internet (ngrok đang chạy)

2. **Kiểm tra ngrok:**
   ```bash
   # Kiểm tra ngrok tunnel
   curl http://localhost:4040/api/tunnels
   ```

3. **Kiểm tra logs:**
   - Xem có lỗi checksum không?
   - Xem có lỗi xử lý payment không?

4. **Test IPN thủ công:**
   - Có thể test bằng cách gọi IPN endpoint trực tiếp (với data hợp lệ)

