import express from "express";
import {
  getAllContracts,
  createContract,
  getContractById,
  updateContract,
  deleteContract,
  getMyContracts,
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
router.get("/contracts", authenticateToken, authorize('ADMIN', 'STAFF'), validatePagination(), asyncHandler(getAllContracts));
router.post("/contracts", authenticateToken, authorize('ADMIN', 'STAFF'), validateBody(createContractSchema), asyncHandler(createContract));
router.get("/contracts/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(contractParamsSchema), asyncHandler(getContractById));
router.put("/contracts/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(contractParamsSchema), validateBody(updateContractSchema), asyncHandler(updateContract));
router.delete("/contracts/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(contractParamsSchema), asyncHandler(deleteContract));

export default router;
