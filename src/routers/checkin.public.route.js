import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { createCashCheckin, createOnlineCheckin, getPrintableSample, downloadSampleDocx, cancelCheckin } from "../controllers/checkin.controller.js";

const router = express.Router();

// Tạo hợp đồng + hóa đơn (đặt cọc + tháng đầu) khi thanh toán tiền mặt
router.post("/checkin/cash", authenticateToken, authorize('ADMIN'), asyncHandler(createCashCheckin));

// Tạo check-in ONLINE: sinh bill phiếu thu UNPAID để thanh toán online
router.post("/checkin/online", authenticateToken, authorize('ADMIN'), asyncHandler(createOnlineCheckin));

// Lấy dữ liệu in hợp đồng mẫu từ Checkin — chỉ khi receipt đã PAID
router.get("/checkins/:id/print-data", authenticateToken, authorize('ADMIN'), asyncHandler(getPrintableSample));
// Tải hợp đồng mẫu DOCX
router.get("/checkins/:id/sample-docx", authenticateToken, authorize('ADMIN'), asyncHandler(downloadSampleDocx));

// (Bỏ) Endpoint scan cờ — không cần theo nghiệp vụ mới

// Hủy check-in trước khi ký — mất 100% tiền cọc
router.post("/checkins/:id/cancel", authenticateToken, authorize('ADMIN'), asyncHandler(cancelCheckin));

export default router;
