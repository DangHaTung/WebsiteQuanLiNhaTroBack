# 🏠 Tro360 - Backend API

Backend API cho hệ thống quản lý nhà trọ thông minh Tro360, được xây dựng với Node.js, Express và MongoDB.

## 📋 Mục lục

- [Giới thiệu](#giới-thiệu)
- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [API Documentation](#api-documentation)
- [Tính năng nổi bật](#tính-năng-nổi-bật)

## 🎯 Giới thiệu

Tro360 Backend là RESTful API server cung cấp các dịch vụ quản lý nhà trọ toàn diện, bao gồm quản lý phòng, hợp đồng, hóa đơn, thanh toán và nhiều tính năng khác.

## ✨ Tính năng

### 🔐 Xác thực & Phân quyền
- Đăng ký, đăng nhập với JWT
- Phân quyền: ADMIN, STAFF, TENANT
- Bảo mật API với middleware authentication

### 🏢 Quản lý Phòng
- CRUD phòng trọ
- Quản lý trạng thái phòng (Available, Occupied, Maintenance)
- Upload hình ảnh phòng
- Quản lý tiện ích phòng (điện, nước, wifi, etc.)

### 📝 Quản lý Hợp đồng
- Tạo hợp đồng thuê phòng
- Gia hạn hợp đồng
- Chấm dứt hợp đồng
- Hợp đồng chính thức (Final Contract)
- Yêu cầu trả phòng (Move-out Request)

### 💰 Quản lý Hóa đơn
- Tạo hóa đơn tự động hàng tháng (Cron Job)
- Hóa đơn nháp (Draft Bills)
- Tính toán hóa đơn theo tỷ lệ (Prorated Billing)
- Quản lý chi phí tiện ích
- Lịch sử thanh toán

### 💳 Thanh toán
- Tích hợp VNPay
- Tích hợp ZaloPay
- Thanh toán tiền mặt
- Webhook/IPN callback
- Lịch sử giao dịch

### 🔔 Thông báo
- Thông báo realtime với Socket.IO
- Thông báo hóa đơn mới
- Thông báo nhắc nhở thanh toán
- Thông báo hợp đồng sắp hết hạn
- CRUD thông báo

### 💬 Chat
- Chat realtime giữa tenant và admin
- Lịch sử tin nhắn
- Đếm tin nhắn chưa đọc
- Socket.IO integration

### 📊 Dashboard & Báo cáo
- Thống kê doanh thu
- Thống kê phòng trống/đã thuê
- Thống kê hóa đơn
- Biểu đồ doanh thu theo tháng

### 📋 Khiếu nại
- Gửi khiếu nại
- Quản lý khiếu nại
- Cập nhật trạng thái xử lý

### 📜 Logs
- Ghi log hoạt động hệ thống
- Theo dõi hành động người dùng
- Audit trail

## 🛠 Công nghệ sử dụng

- **Runtime:** Node.js v18+
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT (jsonwebtoken)
- **Realtime:** Socket.IO
- **File Upload:** Multer
- **Email:** Nodemailer
- **Payment:** VNPay, ZaloPay
- **Cron Jobs:** node-cron
- **Validation:** express-validator
- **Security:** bcryptjs, cors, helmet
- **Environment:** dotenv
- **Transpiler:** Babel (ES6+ support)

## 📦 Cài đặt

### Yêu cầu hệ thống
- Node.js >= 18.0.0
- MongoDB >= 5.0
- npm hoặc yarn

### Các bước cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd WebsiteQuanLiNhaTroBack
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` (xem mục [Cấu hình](#cấu-hình))

4. Khởi động MongoDB (nếu chạy local)

## ⚙️ Cấu hình

Tạo file `.env` trong thư mục root với nội dung:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/tro360

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# VNPay
VNPAY_TMN_CODE=your-vnpay-tmn-code
VNPAY_HASH_SECRET=your-vnpay-hash-secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5173/payment-success
VNPAY_IPN_URL=http://your-domain.com/api/payment/vnpay-ipn

# ZaloPay
ZALOPAY_APP_ID=your-zalopay-app-id
ZALOPAY_KEY1=your-zalopay-key1
ZALOPAY_KEY2=your-zalopay-key2
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create
ZALOPAY_CALLBACK_URL=http://your-domain.com/api/payment/zalopay-callback

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Ngrok (for development)
NGROK_AUTHTOKEN=your-ngrok-authtoken
```

## 🚀 Chạy ứng dụng

### Development mode
```bash
npm run dev
```

### Production mode
```bash
npm start
```

### Chạy với Ngrok (để test webhook)
```bash
npm run ngrok
```

Server sẽ chạy tại: `http://localhost:3000`

## 📁 Cấu trúc thư mục

```
WebsiteQuanLiNhaTroBack/
├── src/
│   ├── controllers/       # Request handlers
│   ├── models/           # Mongoose models
│   ├── routers/          # Express routes
│   ├── services/         # Business logic
│   │   ├── billing/      # Billing services
│   │   └── notification/ # Notification services
│   ├── middleware/       # Custom middleware
│   ├── validations/      # Input validation
│   ├── jobs/            # Cron jobs
│   ├── utils/           # Utility functions
│   └── index.js         # App entry point
├── scripts/             # Utility scripts
├── .env                 # Environment variables
├── .babelrc            # Babel configuration
├── package.json        # Dependencies
└── README.md           # This file
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Hầu hết các endpoint yêu cầu JWT token trong header:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### 🔐 Auth
- `POST /auth/register` - Đăng ký
- `POST /auth/login` - Đăng nhập
- `POST /auth/logout` - Đăng xuất
- `GET /auth/me` - Lấy thông tin user hiện tại

#### 🏢 Rooms
- `GET /rooms/public` - Danh sách phòng (public)
- `GET /rooms` - Danh sách phòng (admin)
- `POST /rooms` - Tạo phòng mới
- `PUT /rooms/:id` - Cập nhật phòng
- `DELETE /rooms/:id` - Xóa phòng

#### 📝 Contracts
- `GET /contracts` - Danh sách hợp đồng
- `POST /contracts` - Tạo hợp đồng
- `PUT /contracts/:id` - Cập nhật hợp đồng
- `POST /contracts/:id/extend` - Gia hạn hợp đồng
- `POST /contracts/:id/terminate` - Chấm dứt hợp đồng

#### 💰 Bills
- `GET /bills` - Danh sách hóa đơn
- `GET /bills/my-bills` - Hóa đơn của tôi
- `POST /bills` - Tạo hóa đơn
- `PUT /bills/:id` - Cập nhật hóa đơn
- `POST /bills/generate-monthly` - Tạo hóa đơn tháng

#### 💳 Payment
- `POST /payment/vnpay/create` - Tạo thanh toán VNPay
- `GET /payment/vnpay-return` - VNPay return URL
- `POST /payment/vnpay-ipn` - VNPay IPN
- `POST /payment/zalopay/create` - Tạo thanh toán ZaloPay
- `POST /payment/zalopay-callback` - ZaloPay callback

#### 🔔 Notifications
- `GET /notifications-crud` - Danh sách thông báo
- `PUT /notifications-crud/:id/read` - Đánh dấu đã đọc
- `GET /notifications-crud/unread/count` - Đếm chưa đọc

#### 💬 Messages
- `GET /messages/conversations` - Danh sách hội thoại
- `GET /messages/:userId` - Tin nhắn với user
- `POST /messages` - Gửi tin nhắn
- `PUT /messages/:userId/read` - Đánh dấu đã đọc

#### 📋 Complaints
- `GET /complaints` - Danh sách khiếu nại
- `POST /complaints` - Tạo khiếu nại
- `PUT /admin/complaints/:id` - Cập nhật khiếu nại

#### 👥 Users
- `GET /users` - Danh sách users (admin)
- `PUT /users/:id` - Cập nhật user
- `PUT /users/:id/lock` - Khóa user
- `PUT /users/:id/unlock` - Mở khóa user

## 🌟 Tính năng nổi bật

### 1. Prorated Billing (Tính hóa đơn theo tỷ lệ)
Hệ thống tự động tính toán hóa đơn theo số ngày thực tế ở trong tháng đầu tiên và tháng cuối cùng.

**Xem thêm:** [PRORATED_BILLING_README.md](./PRORATED_BILLING_README.md)

### 2. Automatic Monthly Billing (Tạo hóa đơn tự động)
Cron job chạy vào 00:00 ngày 1 hàng tháng để tạo hóa đơn cho tất cả phòng đang thuê.

### 3. Rent Reminder (Nhắc nhở thanh toán)
Cron job gửi thông báo nhắc nhở thanh toán vào ngày 25 hàng tháng.

### 4. Realtime Notifications
Socket.IO cung cấp thông báo realtime cho:
- Hóa đơn mới
- Tin nhắn mới
- Cập nhật hợp đồng
- Khiếu nại mới

### 5. Payment Integration
Tích hợp đầy đủ với VNPay và ZaloPay, hỗ trợ:
- Tạo link thanh toán
- Xử lý callback/IPN
- Cập nhật trạng thái tự động

### 6. Comprehensive Logging
Ghi log tất cả hoạt động quan trọng:
- Đăng nhập/đăng xuất
- Tạo/sửa/xóa dữ liệu
- Thanh toán
- Lỗi hệ thống

**Xem thêm:** [LOG_SYSTEM_README.md](./src/services/LOG_SYSTEM_README.md)

### 7. Chat System
Hệ thống chat realtime giữa tenant và admin với:
- Tin nhắn realtime
- Lịch sử chat
- Đếm tin nhắn chưa đọc
- Auto-scroll

**Xem thêm:** [CHAT_SYSTEM_README.md](./CHAT_SYSTEM_README.md)

## 📖 Tài liệu bổ sung

- [Prorated Billing Guide](./PRORATED_BILLING_README.md)
- [Chat System Guide](./CHAT_SYSTEM_README.md)
- [Chat Testing Guide](./CHAT_SYSTEM_TESTING.md)
- [Log System Guide](./src/services/LOG_SYSTEM_README.md)
- [Notification System Guide](./src/services/notification/NOTIFICATION_SYSTEM_README.md)
- [VNPay IPN Setup](./VNPAY_IPN_SETUP.md)
- [ZaloPay IPN Setup](./ZALOPAY_IPN_SETUP.md)
- [Ngrok Setup](./NGROK_SETUP.md)
- [Email Setup](./EMAIL_SETUP.md)

## 🔧 Scripts

```bash
# Development
npm run dev          # Chạy với nodemon + babel-node

# Production
npm start           # Chạy production build

# Ngrok
npm run ngrok       # Chạy ngrok tunnel

# Database
npm run seed        # Seed database (nếu có)
npm run migrate     # Run migrations (nếu có)
```

## 🐛 Debug & Troubleshooting

### Lỗi kết nối MongoDB
```bash
# Kiểm tra MongoDB đang chạy
mongosh

# Hoặc khởi động MongoDB
mongod
```

### Lỗi 403 Forbidden
- Kiểm tra JWT token có hợp lệ không
- Kiểm tra role của user có đủ quyền không

### Webhook không hoạt động
- Sử dụng Ngrok để expose localhost
- Cập nhật callback URL trên VNPay/ZaloPay dashboard
- Xem [NGROK_SETUP.md](./NGROK_SETUP.md)

## 🤝 Contributing

1. Fork repository
2. Tạo branch mới (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- **Your Name** - *Initial work*

## 🙏 Acknowledgments

- Express.js team
- MongoDB team
- Socket.IO team
- VNPay & ZaloPay for payment integration

---

**Ngày cập nhật:** 12/12/2025

**Version:** 1.0.0

**Status:** ✅ Production Ready
