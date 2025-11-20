# 📧 Hướng dẫn cấu hình Email Webmail

## Email dạng webmail (ví dụ: admin@tro360.com)

### 🔍 Cách tìm SMTP settings

#### 1. Email qua Hosting (cPanel/Plesk) - Phổ biến nhất

**Bước 1: Đăng nhập cPanel**
- Truy cập: `https://your-domain.com/cpanel` hoặc `https://your-hosting-ip:2083`
- Đăng nhập với thông tin hosting

**Bước 2: Tìm Email Accounts**
- Vào **Email Accounts** hoặc **Email** section
- Tìm email `admin@tro360.com`
- Click **Configure Mail Client** hoặc **Connect Devices**

**Bước 3: Lấy SMTP settings**
Thông thường sẽ thấy:
```
Incoming Server (IMAP): mail.tro360.com (hoặc mail.hostvn.email)
Outgoing Server (SMTP): mail.tro360.com (hoặc mail.hostvn.email)
Port: 587 (TLS) hoặc 465 (SSL)
Username: admin@tro360.com
Password: [mật khẩu email của bạn]
```

**⚠️ Lưu ý quan trọng:**
- **SMTP Out (Outgoing)** = Dùng để **GỬI** email → Đây là `EMAIL_HOST` trong .env
- **IMAP In (Incoming)** = Dùng để **NHẬN** email → Không cần cho hệ thống gửi email

**Cấu hình .env:**
```env
# Lấy từ "Outgoing Server (SMTP)" trong cấu hình Outlook
EMAIL_HOST=mail.hostvn.email
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=admin@tro360.com
EMAIL_PASS=your-email-password
EMAIL_FROM_NAME=Hệ thống Quản lý Phòng trọ
```

**Ví dụ với hostvn.net:**
Nếu nhà cung cấp cho bạn:
- IMAP in: `mail.hostvn.email`
- SMTP out: `mail.hostvn.email`

→ Dùng **SMTP out** làm `EMAIL_HOST`:
```env
EMAIL_HOST=mail.hostvn.email
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=admin@tro360.com
EMAIL_PASS=password-cua-email-admin
```

**Nếu port 465:**
```env
EMAIL_HOST=mail.hostvn.email
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=admin@tro360.com
EMAIL_PASS=your-email-password
```

---

#### 2. Email qua Google Workspace

Nếu domain `tro360.com` dùng Google Workspace:

**Bước 1: Tạo App Password**
1. Đăng nhập Google Account: https://myaccount.google.com
2. Security → 2-Step Verification (bật nếu chưa có)
3. App passwords → Select app: "Mail" → Select device: "Other"
4. Copy password (16 ký tự, có khoảng trắng)

**Cấu hình .env:**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=admin@tro360.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM_NAME=Hệ thống Quản lý Phòng trọ
```

---

#### 3. Email qua Zoho Mail

Nếu domain `tro360.com` dùng Zoho:

**Bước 1: Tạo App Password**
1. Đăng nhập Zoho Mail
2. Settings → Security → App Passwords
3. Tạo app password mới

**Cấu hình .env:**
```env
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=admin@tro360.com
EMAIL_PASS=your-app-password
EMAIL_FROM_NAME=Hệ thống Quản lý Phòng trọ
```

---

#### 4. Email qua Microsoft 365

**Cấu hình .env:**
```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=admin@tro360.com
EMAIL_PASS=your-password
EMAIL_FROM_NAME=Hệ thống Quản lý Phòng trọ
```

---

## 🧪 Test cấu hình email

Sau khi cấu hình `.env`, chạy script test:

```bash
cd WebsiteQuanLiNhaTroBack
node scripts/test-email.js
```

Script sẽ:
1. ✅ Kiểm tra environment variables
2. 🔌 Test kết nối SMTP
3. 📧 Gửi email test

**Nếu muốn gửi test email đến email khác:**
```bash
TEST_EMAIL_TO=your-email@example.com node scripts/test-email.js
```

---

## ❌ Troubleshooting

### Lỗi: "Connection timeout"
- **Nguyên nhân:** Firewall chặn port hoặc EMAIL_HOST sai
- **Giải pháp:**
  - Kiểm tra EMAIL_HOST (thử `mail.tro360.com`, `smtp.tro360.com`)
  - Kiểm tra port (587 hoặc 465)
  - Liên hệ hosting provider để mở port

### Lỗi: "Authentication failed"
- **Nguyên nhân:** Username/password sai
- **Giải pháp:**
  - Kiểm tra lại EMAIL_USER và EMAIL_PASS
  - Với Gmail/Zoho: dùng App Password, không dùng mật khẩu chính
  - Reset password email nếu cần

### Lỗi: "Self-signed certificate"
- **Nguyên nhân:** SSL certificate không hợp lệ
- **Giải pháp:** Thêm vào transporter config:
  ```javascript
  tls: {
    rejectUnauthorized: false
  }
  ```
  (Chỉ dùng cho development, không dùng production)

### Email bị vào Spam
- **Giải pháp:**
  1. Cấu hình SPF record trong DNS
  2. Cấu hình DKIM record
  3. Cấu hình DMARC record
  4. Liên hệ hosting provider để setup

---

## 📋 Checklist cấu hình

- [ ] Đã tạo email `admin@tro360.com`
- [ ] Đã lấy SMTP settings từ hosting/email provider
- [ ] Đã cấu hình `.env` với đúng thông tin
- [ ] Đã test bằng `node scripts/test-email.js`
- [ ] Email test đã nhận được thành công
- [ ] Đã kiểm tra spam folder

---

## 💡 Tips

1. **Dùng email riêng cho hệ thống:** Tạo `noreply@tro360.com` hoặc `system@tro360.com` thay vì dùng email cá nhân
2. **Bảo mật:** Không commit file `.env` lên git
3. **Production:** Nên dùng email service chuyên dụng (SendGrid, Mailgun) cho production
4. **Rate limiting:** Một số hosting giới hạn số email/giờ, kiểm tra với provider

---

## 📞 Liên hệ hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra logs: `console.log` trong `notification.service.js`
2. Chạy test script để xem lỗi chi tiết
3. Liên hệ hosting provider để xác nhận SMTP settings
4. Kiểm tra DNS records (MX, SPF, DKIM) nếu email bị spam

