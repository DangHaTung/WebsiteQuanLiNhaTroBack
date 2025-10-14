import express from "express";
import {
  getAllContracts,
  createContract,
  getContractById,
  updateContract,
  deleteContract,
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

// Tất cả route đều cần xác thực
router.use(authenticateToken);

// Chỉ ADMIN và STAFF mới có thể quản lý contracts
router.use(authorize('ADMIN', 'STAFF'));

router.get("/contracts", validatePagination(), asyncHandler(getAllContracts));
router.post("/contracts", validateBody(createContractSchema), asyncHandler(createContract));
router.get("/contracts/:id", validateParams(contractParamsSchema), asyncHandler(getContractById));
router.put("/contracts/:id", validateParams(contractParamsSchema), validateBody(updateContractSchema), asyncHandler(updateContract));
router.delete("/contracts/:id", validateParams(contractParamsSchema), asyncHandler(deleteContract));

export default router;
