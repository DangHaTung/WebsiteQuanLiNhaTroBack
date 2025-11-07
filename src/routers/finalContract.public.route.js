import express from "express";
import {
  createFromContract,
  getFinalContractById,
  viewFileInline,
} from "../controllers/finalContract.controller.js";
import { createFinalContractSchema, finalContractParamsSchema, viewFileParamsSchema } from "../validations/finalContract.validation.js";
import { validateBody, validateParams } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Create final contract draft from existing contract (tenant after deposit)
router.post(
  "/final-contracts",
  authenticateToken,
  validateBody(createFinalContractSchema),
  asyncHandler(createFromContract)
);

// Get final contract by id (tenant or admin)
router.get(
  "/final-contracts/public/:id",
  authenticateToken,
  validateParams(finalContractParamsSchema),
  asyncHandler(getFinalContractById)
);

// Inline viewer for a specific file (primarily PDFs uploaded as raw)
router.get(
  "/final-contracts/public/:id/files/:index/view",
  authenticateToken,
  validateParams(viewFileParamsSchema),
  asyncHandler(viewFileInline)
);

export default router;