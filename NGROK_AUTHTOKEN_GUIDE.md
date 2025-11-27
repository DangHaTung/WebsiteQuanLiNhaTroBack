# Hướng dẫn lấy Ngrok Authtoken

## Format của Ngrok Authtoken

Ngrok authtoken thường có format như:
```
2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz_1A2B3C4D5E6F7G8H9I0J
```

- Độ dài: ~40-50 ký tự
- Chứa chữ số, chữ cái, và dấu gạch dưới
- Là **một chuỗi duy nhất**, không phải nhiều mã ngắn

## Cách lấy Authtoken đúng

### Bước 1: Đăng ký/Đăng nhập
1. Truy cập: https://dashboard.ngrok.com/signup
2. Đăng ký account miễn phí (hoặc đăng nhập nếu đã có)

### Bước 2: Lấy Authtoken
1. Sau khi đăng nhập, truy cập: https://dashboard.ngrok.com/get-started/your-authtoken
2. Bạn sẽ thấy authtoken của bạn (một chuỗi dài)
3. Click nút **"Copy"** để copy authtoken

### Bước 3: Set Authtoken

**Cách 1: Set trực tiếp (tạm thời)**
```bash
export NGROK_AUTH_TOKEN=your_full_authtoken_here
```

**Cách 2: Thêm vào .env (khuyến nghị)**
Thêm dòng này vào file `.env`:
```
NGROK_AUTH_TOKEN=your_full_authtoken_here
```

**Cách 3: Set bằng ngrok command (khuyến nghị nhất)**
```bash
ngrok config add-authtoken your_full_authtoken_here
```

Cách này sẽ lưu authtoken vào config file của ngrok, không cần set environment variable.

### Bước 4: Verify
```bash
ngrok config check
```

Nếu thấy "Valid configuration" thì đã set đúng.

## Lưu ý

- Authtoken là **một chuỗi duy nhất**, không phải nhiều mã
- Không chia sẻ authtoken với người khác
- Nếu mất authtoken, có thể tạo lại từ dashboard

