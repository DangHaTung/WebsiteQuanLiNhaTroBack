import express from "express";
import { getAllBills, getMyBills, getBillById } from "../controllers/bill.controller.js";
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
router.get("/bills/pending-payment", authenticateToken, asyncHandler(async (req, res) => {
  const { getMyPendingPayment } = await import("../controllers/bill.controller.js");
  return getMyPendingPayment(req, res);
}));

export default router;

