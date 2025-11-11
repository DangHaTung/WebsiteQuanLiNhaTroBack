import express from "express";
import { getAllBills, getBillById, createBill, updateBill, getMyBills, confirmCashReceipt, cancelBill } from "../controllers/bill.controller.js";
import { 
  createBillSchema, 
  updateBillSchema, 
  billParamsSchema 
} from "../validations/bill.validation.js";
import { 
  validateBody, 
  validateParams, 
  validatePagination 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN/STAFF =====
// Public routes đã được tách ra file riêng: bill.public.route.js
router.get("/bills", authenticateToken, authorize('ADMIN'), validatePagination(), asyncHandler(getAllBills));
router.get("/bills/:id", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(getBillById));
router.post("/bills", authenticateToken, authorize('ADMIN'), validateBody(createBillSchema), asyncHandler(createBill));
router.put("/bills/:id", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), validateBody(updateBillSchema), asyncHandler(updateBill));
// Xác nhận tiền mặt cho bill phiếu thu
router.post("/bills/:id/confirm-cash", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(confirmCashReceipt));
// Hủy hóa đơn (cancel) thay cho delete
router.put("/bills/:id/cancel", authenticateToken, authorize('ADMIN'), validateParams(billParamsSchema), asyncHandler(cancelBill));

export default router;
