import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { uploadCccdImages } from "../middleware/upload.middleware.js";
import { createCashCheckin, createOnlineCheckin, getPrintableSample, downloadSampleDocx, cancelCheckin, getAllCheckins, completeCheckin, extendReceipt, updateVehicles, getCheckinById } from "../controllers/checkin.controller.js";

const router = express.Router();

// Get all checkins (Admin)
router.get("/checkins", authenticateToken, authorize('ADMIN'), asyncHandler(getAllCheckins));

// Tạo hợp đồng + hóa đơn (đặt cọc + tháng đầu) khi thanh toán tiền mặt
router.post("/checkin/cash", authenticateToken, authorize('ADMIN'), uploadCccdImages, asyncHandler(createCashCheckin));

// Tạo check-in ONLINE: sinh bill phiếu thu UNPAID để thanh toán online
router.post("/checkin/online", authenticateToken, authorize('ADMIN'), uploadCccdImages, asyncHandler(createOnlineCheckin));

// Lấy dữ liệu in hợp đồng mẫu từ Checkin — chỉ khi receipt đã PAID
router.get("/checkins/:id/print-data", authenticateToken, authorize('ADMIN'), asyncHandler(getPrintableSample));
// Tải hợp đồng mẫu DOCX
router.get("/checkins/:id/sample-docx", authenticateToken, authorize('ADMIN'), asyncHandler(downloadSampleDocx));

// Đánh dấu check-in hoàn thành
router.put("/checkins/:id/complete", authenticateToken, authorize('ADMIN'), asyncHandler(completeCheckin));

// Hủy check-in trước khi ký — mất 100% tiền cọc
router.post("/checkins/:id/cancel", authenticateToken, authorize('ADMIN'), asyncHandler(cancelCheckin));

// Gia hạn phiếu thu - thêm tiền cọc và thời hạn
router.post("/checkins/:id/extend", authenticateToken, authorize('ADMIN'), asyncHandler(extendReceipt));

// Lấy thông tin checkin theo ID
router.get("/checkins/:id", authenticateToken, authorize('ADMIN'), asyncHandler(getCheckinById));

// Cập nhật danh sách xe cho checkin
router.put("/checkins/:id/vehicles", authenticateToken, authorize('ADMIN'), asyncHandler(updateVehicles));

export default router;
