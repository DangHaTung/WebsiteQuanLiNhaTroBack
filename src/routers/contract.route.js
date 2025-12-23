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
  linkCoTenantToContract,
  addCoTenant,
  removeCoTenant,
} from "../controllers/contract.controller.js";
import { 
  createContractSchema, 
  updateContractSchema, 
  contractParamsSchema,
  refundDepositSchema,
  removeCoTenantParamsSchema,
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
// TEMP: Bỏ auth để test
router.get("/contracts", validatePagination(), asyncHandler(getAllContracts));
router.post("/contracts", authenticateToken, authorize('ADMIN'), validateBody(createContractSchema), asyncHandler(createContract));
router.get("/contracts/:id", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(getContractById));
router.get("/contracts/:id/print-data", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(getPrintableContract));
router.put("/contracts/:id", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), validateBody(updateContractSchema), asyncHandler(updateContract));
router.delete("/contracts/:id", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(deleteContract));
// Hoàn cọc khi hợp đồng ENDED
router.post("/contracts/:id/refund-deposit", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), validateBody(refundDepositSchema), asyncHandler(refundDeposit));
// Link co-tenant vào contract
router.post("/contracts/:id/link-cotenant", authenticateToken, authorize('ADMIN'), validateParams(contractParamsSchema), asyncHandler(linkCoTenantToContract));
// Add co-tenant (không cần thanh toán) - ADMIN only
router.post(
  "/contracts/:id/add-cotenant",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(contractParamsSchema),
  asyncHandler(addCoTenant)
);
// Remove co-tenant khỏi phòng (không xóa tài khoản)
router.post(
  "/contracts/:id/remove-cotenant/:userId",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(removeCoTenantParamsSchema),
  asyncHandler(removeCoTenant)
);

export default router;
