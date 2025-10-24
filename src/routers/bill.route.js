import express from "express";
import { getAllBills, getBillById, createBill, updateBill, deleteBill, getMyBills } from "../controllers/bill.controller.js";
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
router.get("/bills", authenticateToken, authorize('ADMIN', 'STAFF'), validatePagination(), asyncHandler(getAllBills));
router.get("/bills/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(billParamsSchema), asyncHandler(getBillById));
router.post("/bills", authenticateToken, authorize('ADMIN', 'STAFF'), validateBody(createBillSchema), asyncHandler(createBill));
router.put("/bills/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(billParamsSchema), validateBody(updateBillSchema), asyncHandler(updateBill));
router.delete("/bills/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(billParamsSchema), asyncHandler(deleteBill));

export default router;
