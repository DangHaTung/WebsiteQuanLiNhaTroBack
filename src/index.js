import "dotenv/config";
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
import {
  errorHandler,
  notFound,
  requestLogger,
} from "./middleware/error.middleware.js";
import payRouter from "./routers/payment.route.js";

const app = express();

// Middleware logging request
app.use(requestLogger);

// Cho phép CORS (frontend gọi được)
app.use(cors());

// Phân tích dữ liệu JSON và form
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/payment", payRouter);
// Đăng ký route
app.use("/api", authRoute);
app.use("/api", tenantRoute);
app.use("/api", billRoute);
app.use("/api", contractRoute);
app.use("/api", roomRoute);
app.use("/api", logRoute);


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
