import 'dotenv/config';
// dotenv.config();
import express from "express";
import { createServer } from "http";
import mongoose from "mongoose";
import cors from "cors";
import authRoute from "./routers/auth.route.js";
import billRoute from "./routers/bill.route.js";
import tenantRoute from "./routers/tenant.route.js"; // import thêm route tenant
import contractRoute from "./routers/contract.route.js"; // import thêm route contract
import logRoute from "./routers/log.route.js"; // import thêm route log
import roomRoute from "./routers/room.route.js";
import roomPublicRoute from "./routers/room.public.route.js"; // PUBLIC room routes
import billPublicRoute from "./routers/bill.public.route.js"; // PUBLIC bill routes
import contractPublicRoute from "./routers/contract.public.route.js"; // PUBLIC contract routes
import finalContractPublicRoute from "./routers/finalContract.public.route.js"; // PUBLIC final contract routes
import tenantPublicRoute from "./routers/tenant.public.route.js"; // PUBLIC tenant routes
import userRoute from "./routers/user.route.js";
import complaintRoute from "./routers/complaint.route.js"; // ADMIN complaint routes
import complaintPublicRoute from "./routers/complaint.public.route.js"; // PUBLIC complaint routes
import utilRoute from "./routers/util.route.js"; // ADMIN utility routes
import utilityFeeRoute from "./routers/utilityFee.route.js"; // ADMIN utility fee routes
import roomFeeRoute from "./routers/roomFee.route.js"; // ADMIN room fee routes
import { errorHandler, notFound, requestLogger } from "./middleware/error.middleware.js";
import payRouter from "./routers/payment.route.js";
import checkinPublicRoute from "./routers/checkin.public.route.js"; // PUBLIC checkin routes
import finalContractRoute from "./routers/finalContract.route.js"; // PROTECTED final contract routes
import monthlyBillRoute from "./routers/monthlyBill.route.js"; // Monthly bill generation routes
import notificationRoute from "./routers/notification.route.js"; // Notification routes
import moveOutRequestRoute from "./routers/moveOutRequest.route.js"; // Move-out request routes
import { scheduleMonthlyBillingJob } from "./jobs/monthlyBilling.job.js"; // Cron job tự động tạo hóa đơn
import { scheduleRentReminderJob } from "./jobs/rentReminder.job.js"; // Cron job nhắc nhở thanh toán
import { scheduleUpcomingBillJob } from "./jobs/upcomingBill.job.js"; // Cron job thông báo hóa đơn sắp tới
import { initializeSocketIO } from "./services/socket/socket.service.js"; // Socket.io service



const app = express();
const httpServer = createServer(app);

// Middleware logging request
app.use(requestLogger);

// Cho phép CORS (frontend gọi được)
app.use(cors());

// Phân tích dữ liệu JSON và form
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use("/api/payment", payRouter);
// Đăng ký route
// QUAN TRỌNG: Đăng ký PUBLIC routes TRƯỚC các route có middleware
app.use("/api", roomPublicRoute);      // /rooms/public
app.use("/api", billPublicRoute);      // /bills/my-bills
app.use("/api", contractPublicRoute);  // /contracts/my-contracts
app.use("/api", finalContractPublicRoute);  // /final-contracts (create & public get)
app.use("/api", tenantPublicRoute);    // /tennant, /tennant/my-tenant
app.use("/api", checkinPublicRoute);   // /checkin/cash
app.use("/api/complaints", complaintPublicRoute); // PUBLIC complaint routes

// Đăng ký PROTECTED routes (cần auth)
app.use("/api", moveOutRequestRoute); // Move-out request routes (Client + Admin) - Đặt trước các route khác
app.use("/api", authRoute);
app.use("/api", tenantRoute);   // ADMIN tenant routes
app.use("/api", billRoute);     // ADMIN bill routes
app.use("/api", contractRoute); // ADMIN contract routes
app.use("/api", finalContractRoute); // ADMIN final contract routes
app.use("/api", roomRoute);     // ADMIN room routes
app.use("/api", logRoute);

app.use("/api", userRoute);
app.use("/api/admin/complaints", complaintRoute); // ADMIN complaint routes
app.use("/api", utilRoute); // ADMIN utility routes
app.use("/api", utilityFeeRoute); // ADMIN utility fee routes (independent from room utilities)
app.use("/api", roomFeeRoute); // ADMIN room fee routes
app.use("/api", monthlyBillRoute); // ADMIN monthly bill generation routes
app.use("/api/notifications", notificationRoute); // Notification routes (Socket.io testing & rent reminders)

// Middleware xử lý route không tồn tại
app.use(notFound);

// Middleware xử lý lỗi chung
app.use(errorHandler);

// Kết nối MongoDB
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/rental_management";
mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("✅ Kết nối MongoDB thành công");
    const conn = mongoose.connection;
    const info = conn?.host ? `${conn.host}:${conn?.port}` : 'unknown-host';
    // In ra thông tin DB để đối chiếu với Compass
    console.log(`📦 Đang dùng DB: ${conn.name} @ ${info}`);
    
    const PORT = process.env.PORT || 3000;
    
    // Khởi tạo Socket.io
    initializeSocketIO(httpServer);
    console.log('✅ Socket.io đã được khởi tạo');
    
    // Khởi động HTTP server (thay vì app.listen)
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
      
      // Khởi động cron job tự động tạo hóa đơn hàng tháng
      if (process.env.ENABLE_MONTHLY_BILLING_JOB !== 'false') {
        scheduleMonthlyBillingJob();
        console.log('✅ Cron job tạo hóa đơn hàng tháng đã được kích hoạt');
      } else {
        console.log('⚠️  Cron job tạo hóa đơn hàng tháng đã bị tắt (ENABLE_MONTHLY_BILLING_JOB=false)');
      }
      
      // Khởi động cron job nhắc nhở thanh toán
      if (process.env.ENABLE_RENT_REMINDER_JOB !== 'false') {
        scheduleRentReminderJob();
        console.log('✅ Cron job nhắc nhở thanh toán đã được kích hoạt');
      } else {
        console.log('⚠️  Cron job nhắc nhở thanh toán đã bị tắt (ENABLE_RENT_REMINDER_JOB=false)');
      }
      
      // Khởi động cron job thông báo hóa đơn sắp tới
      if (process.env.ENABLE_UPCOMING_BILL_JOB !== 'false') {
        scheduleUpcomingBillJob();
        console.log('✅ Cron job thông báo hóa đơn sắp tới đã được kích hoạt (ngày 29 và ngày 3)');
      } else {
        console.log('⚠️  Cron job thông báo hóa đơn sắp tới đã bị tắt (ENABLE_UPCOMING_BILL_JOB=false)');
      }
    });
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });
