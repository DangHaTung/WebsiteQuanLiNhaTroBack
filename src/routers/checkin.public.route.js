import express from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { createCashCheckin } from "../controllers/checkin.controller.js";

const router = express.Router();

// Tạo hợp đồng + hóa đơn (đặt cọc + tháng đầu) khi thanh toán tiền mặt
router.post("/checkin/cash", authenticateToken, asyncHandler(createCashCheckin));

export default router;
