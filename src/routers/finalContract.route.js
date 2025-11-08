import express from "express";
import {
  uploadFiles,
  uploadCCCDFile,
  approveOwnerSigned,
  getRemainingAmount,
} from "../controllers/finalContract.controller.js";
import { finalContractParamsSchema } from "../validations/finalContract.validation.js";
import { validateParams } from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { uploadFinalContractFiles, uploadCCCDFiles } from "../middleware/upload.middleware.js";

const router = express.Router();

// Upload signed contract files (images/PDF)
router.post(
  "/final-contracts/:id/upload",
  authenticateToken,
  validateParams(finalContractParamsSchema),
  uploadFinalContractFiles,
  asyncHandler(uploadFiles)
);

// Upload CCCD files for tenant verification
router.post(
  "/final-contracts/:id/upload-cccd",
  authenticateToken,
  validateParams(finalContractParamsSchema),
  uploadCCCDFiles,
  asyncHandler(uploadCCCDFile)
);

// Admin/Manager approves owner signature
router.put(
  "/final-contracts/:id/approve",
  authenticateToken,
  authorize('ADMIN', 'STAFF'),
  validateParams(finalContractParamsSchema),
  asyncHandler(approveOwnerSigned)
);

// Remaining balance after deposit
router.get(
  "/final-contracts/:id/remaining",
  authenticateToken,
  validateParams(finalContractParamsSchema),
  asyncHandler(getRemainingAmount)
);

export default router;