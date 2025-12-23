// Routes cho monthly bill generation
import express from "express";
import {
  previewMonthlyBill,
  createSingleMonthlyBill,
  createBatchMonthlyBills,
  autoGenerateMonthlyBills,
  sendBillNotification,
} from "../controllers/monthlyBill.controller.js";
import {
  createSingleBillSchema,
  createBatchBillsSchema,
  autoGenerateBillsSchema,
  previewBillQuerySchema,
  contractParamsSchema,
} from "../validations/monthlyBill.validation.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN/STAFF =====

/**
 * Preview tính toán hóa đơn cho một phòng (không tạo bill thật)
 * GET /api/monthly-bills/preview/:contractId?electricityKwh=100&waterM3=5&occupantCount=2
 */
router.get(
  "/monthly-bills/preview/:contractId",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateParams(contractParamsSchema),
  validateQuery(previewBillQuerySchema),
  asyncHandler(previewMonthlyBill)
);

/**
 * Tạo hóa đơn hàng tháng cho một phòng cụ thể
 * POST /api/monthly-bills/create-single
 * Body: { contractId, electricityKwh, waterM3, occupantCount, billingDate?, note? }
 */
router.post(
  "/monthly-bills/create-single",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateBody(createSingleBillSchema),
  asyncHandler(createSingleMonthlyBill)
);

/**
 * Tạo hóa đơn hàng tháng cho nhiều phòng với dữ liệu tiêu thụ cụ thể
 * POST /api/monthly-bills/create-batch
 * Body: {
 *   billingDate?: Date,
 *   roomUsageData: {
 *     "roomId1": { electricityKwh: 100, waterM3: 5, occupantCount: 2 },
 *     "roomId2": { electricityKwh: 80, waterM3: 4, occupantCount: 1 }
 *   }
 * }
 */
router.post(
  "/monthly-bills/create-batch",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateBody(createBatchBillsSchema),
  asyncHandler(createBatchMonthlyBills)
);

/**
 * Tự động tạo hóa đơn hàng tháng cho tất cả phòng (dùng giá trị mặc định)
 * POST /api/monthly-bills/auto-generate
 * Body: { billingDate?: Date }
 */
router.post(
  "/monthly-bills/auto-generate",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateBody(autoGenerateBillsSchema),
  asyncHandler(autoGenerateMonthlyBills)
);

/**
 * Gửi email thông báo hóa đơn cho tenant (thủ công)
 * POST /api/monthly-bills/send-notification/:billId
 */
router.post(
  "/monthly-bills/send-notification/:billId",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  asyncHandler(sendBillNotification)
);

export default router;
