import 'dotenv/config';
// dotenv.config();
import express from "express";
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
import searchRoute from "./routers/search.route.js";
import finalContractRoute from "./routers/finalContract.route.js"; // PROTECTED final contract routes

const app = express();

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
app.use("/api/search", searchRoute);

// Đăng ký PROTECTED routes (cần auth)
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
    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });
