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
import tenantPublicRoute from "./routers/tenant.public.route.js"; // PUBLIC tenant routes
import userRoute from "./routers/user.route.js";
import complaintRoute from "./routers/complaint.route.js"; // import thêm route complaint
import { errorHandler, notFound, requestLogger } from "./middleware/error.middleware.js";
import payRouter from "./routers/payment.route.js";
import paymentZaloRoute from "./routers/payment.route.js"


const app = express();

// Middleware logging request
app.use(requestLogger);

// Cho phép CORS (frontend gọi được)
app.use(cors());

// Phân tích dữ liệu JSON và form
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Đăng ký route
// QUAN TRỌNG: Đăng ký PUBLIC routes TRƯỚC các route có middleware
app.use("/api", roomPublicRoute);      // /rooms/public
app.use("/api", billPublicRoute);      // /bills/my-bills
app.use("/api", contractPublicRoute);  // /contracts/my-contracts
app.use("/api", tenantPublicRoute);    // /tennant, /tennant/my-tenant

// Đăng ký PROTECTED routes (cần auth)
app.use("/api", authRoute);
app.use("/api", tenantRoute);   // ADMIN tenant routes
app.use("/api", billRoute);     // ADMIN bill routes
app.use("/api", contractRoute); // ADMIN contract routes
app.use("/api", roomRoute);     // ADMIN room routes
app.use("/api", logRoute);
app.use("/api", userRoute);
app.use("/api", complaintRoute);
app.use("/pay", payRouter);
app.use("/api/payment", paymentZaloRoute)

// Middleware xử lý route không tồn tại
app.use(notFound);

// Middleware xử lý lỗi chung
app.use(errorHandler);

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Kết nối MongoDB thành công");
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });
