import express from "express";
import {
  getAllContracts,
  createContract,
  getContractById,
  getPrintableContract,
  updateContract,
  deleteContract,
  getMyContracts,
  refundDeposit,
} from "../controllers/contract.controller.js";
import { 
  createContractSchema, 
  updateContractSchema, 
  contractParamsSchema 
} from "../validations/contract.validation.js";
import { 
  validateBody, 
  validateParams, 
  validatePagination 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN/STAFF =====
// Public routes đã được tách ra file riêng: contract.public.route.js
router.get("/contracts", authenticateToken, authorize('ADMIN'), validatePagination(), asyncHandler(getAllContracts));
router.post("/contracts", authenticateToken, authorize('ADMIN'), validateBody(createContractSchema), asyncHandler(createContract));
router.get("/contracts/:id", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(getContractById));
router.get("/contracts/:id/print-data", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(getPrintableContract));
router.put("/contracts/:id", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), validateBody(updateContractSchema), asyncHandler(updateContract));
router.delete("/contracts/:id", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(deleteContract));
// Hoàn cọc khi hợp đồng ENDED
router.post("/contracts/:id/refund-deposit", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(refundDeposit));

export default router;
