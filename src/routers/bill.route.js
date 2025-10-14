import express from "express";
import { getAllBills, getBillById, createBill, updateBill, deleteBill } from "../controllers/bill.controller.js";
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

// Tất cả route đều cần xác thực
router.use(authenticateToken);

// Chỉ ADMIN và STAFF mới có thể quản lý bills
router.use(authorize('ADMIN', 'STAFF'));

router.get("/bills", validatePagination(), asyncHandler(getAllBills));
router.get("/bills/:id", validateParams(billParamsSchema), asyncHandler(getBillById));
router.post("/bills", validateBody(createBillSchema), asyncHandler(createBill));
router.put("/bills/:id", validateParams(billParamsSchema), validateBody(updateBillSchema), asyncHandler(updateBill));
router.delete("/bills/:id", validateParams(billParamsSchema), asyncHandler(deleteBill));

export default router;
