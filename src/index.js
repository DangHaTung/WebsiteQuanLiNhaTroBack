import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoute from "./routers/auth.route.js";
import billRoute from "./routers/bill.route.js";
import tenantRoute from "./routers/tenant.route.js";
import contractRoute from "./routers/contract.route.js";
import logRoute from "./routers/log.route.js";
import roomRoute from "./routers/room.route.js";
import businessRoute from "./routers/business.route.js";

// Import middlewares
import { globalErrorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { securityHeaders, apiLimiter, authLimiter, sanitizeInput, securityLogger } from "./middlewares/security.middleware.js";

dotenv.config();

const app = express();

// Security middleware (phải đặt đầu tiên)
app.use(securityHeaders);
app.use(securityLogger);
app.use(sanitizeInput);

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Cho phép CORS (frontend gọi được)
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Phân tích dữ liệu JSON và form
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Đăng ký route
app.use("/api", authRoute);
app.use("/api", tenantRoute);
app.use("/api", billRoute);
app.use("/api", contractRoute);
app.use("/api", roomRoute);
app.use("/api", logRoute);
app.use("/api/business", businessRoute);

// 404 handler
app.use(notFoundHandler);

// Global error handler (phải đặt cuối cùng)
app.use(globalErrorHandler);

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
