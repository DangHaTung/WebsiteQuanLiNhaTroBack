import express from "express";
import { getAllBills, getBillById, createBill, updateBill, getMyBills, confirmCashReceipt, rejectCashPayment, cancelBill, calculateMonthlyFees, generatePaymentLink } from "../controllers/bill.controller.js";
import { 
  createBillSchema, 
  updateBillSchema, 
  billParamsSchema,
  billIdParamsSchema,
  publishDraftBillSchema,
  publishBatchBillsSchema
} from "../validations/bill.validation.js";
import { 
  validateBody, 
  validateParams, 
  validatePagination 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN =====
// Public routes đã được tách ra file riêng: bill.public.route.js
router.get("/bills", authenticateToken, authorize('ADMIN'), validatePagination(), asyncHandler(getAllBills));
router.get("/bills/drafts", authenticateToken, authorize('ADMIN'), validatePagination(), asyncHandler(async (req, res) => {
  const { getDraftBills } = await import("../controllers/bill.controller.js");
  return getDraftBills(req, res);
}));
router.get("/bills/:id", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(getBillById));
router.post("/bills", authenticateToken, authorize('ADMIN'), validateBody(createBillSchema), asyncHandler(createBill));
router.put("/bills/:id", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), validateBody(updateBillSchema), asyncHandler(updateBill));
// Phát hành bill nháp (DRAFT → UNPAID)
router.put("/bills/:id/publish", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), validateBody(publishDraftBillSchema), asyncHandler(async (req, res) => {
  const { publishDraftBill } = await import("../controllers/bill.controller.js");
  return publishDraftBill(req, res);
}));
// Phát hành nhiều bills cùng lúc
router.post("/bills/publish-batch", authenticateToken, authorize('ADMIN'), validateBody(publishBatchBillsSchema), asyncHandler(async (req, res) => {
  const { publishBatchDraftBills } = await import("../controllers/bill.controller.js");
  return publishBatchDraftBills(req, res);
}));
// Xác nhận thanh toán tiền mặt cho RECEIPT bill (admin only)
router.post("/bills/:id/confirm-payment", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(confirmCashReceipt));
// Từ chối thanh toán tiền mặt (admin only)
router.post("/bills/:id/reject-payment", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(rejectCashPayment));
// Hủy hóa đơn (cancel) thay cho delete
router.put("/bills/:id/cancel", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(cancelBill));
// Tính toán phí dịch vụ (cho hoàn cọc)
router.post("/bills/calculate-monthly-fees", authenticateToken, authorize('ADMIN'), asyncHandler(calculateMonthlyFees));
// Generate payment link và gửi email (admin only)
router.post("/bills/:id/generate-payment-link", authenticateToken, authorize('ADMIN'), validateParams(billIdParamsSchema), asyncHandler(generatePaymentLink));

export default router;
