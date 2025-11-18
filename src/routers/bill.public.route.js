import express from "express";
import { getMyBills, getBillById, getBillsByFinalContractId, getMyPendingPayment, requestCashPayment } from "../controllers/bill.controller.js";
import { validatePagination, validateParams } from "../middleware/validation.middleware.js";
import { billParamsSchema } from "../validations/bill.validation.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Route cho client xem bills của mình (cần auth nhưng không cần admin)
router.get("/bills/my-bills", authenticateToken, validatePagination(), asyncHandler(getMyBills));

// Route cho client xem bill theo ID (cần auth nhưng không cần admin)
router.get("/bills/public/:id", authenticateToken, validateParams(billParamsSchema), asyncHandler(getBillById));

// Route: Lấy danh sách bill chưa thanh toán
router.get("/bills/pending-payment", authenticateToken, asyncHandler(getMyPendingPayment));

// Route: Lấy bills theo finalContractId
router.get("/bills/final-contract/:finalContractId", authenticateToken, asyncHandler(getBillsByFinalContractId));

// Route: Tenant request thanh toán tiền mặt
router.post("/bills/:id/pay-cash", authenticateToken, validateParams(billParamsSchema), asyncHandler(requestCashPayment));

export default router;

