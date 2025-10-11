import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoute from "./routers/auth.route.js";
import billRoute from "./routers/bill.route.js";
import tenantRoute from "./routers/tenant.route.js"; // import thêm route tenant
import logRoute from "./routers/log.route.js"; // import thêm route log


dotenv.config();

const app = express();

// Middleware cơ bản
app.use((req, res, next) => {
next();
});

// Cho phép CORS (frontend gọi được)
app.use(cors());

// Phân tích dữ liệu JSON và form
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Đăng ký route
app.use("/api", authRoute);
app.use("/api", tenantRoute); 
app.use("/api", billRoute);
app.use("/api", logRoute);


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
