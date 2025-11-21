import express from "express";
import {
  getAllFinalContracts,
  uploadFiles,
  getRemainingAmount,
  deleteFinalContractById,
  assignTenantToFinalContract,
  deleteFileFromFinalContract,
  createForCoTenant,
  cancelFinalContract,
} from "../controllers/finalContract.controller.js";
import { finalContractParamsSchema, deleteFileParamsSchema, assignTenantSchema } from "../validations/finalContract.validation.js";
import { validateParams, validateBody, validatePagination } from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { uploadFinalContractFiles } from "../middleware/upload.middleware.js";

const router = express.Router();

// Get all final contracts (Admin only)
router.get(
  "/final-contracts",
  authenticateToken,
  authorize('ADMIN'),
  validatePagination(),
  asyncHandler(getAllFinalContracts)
);

// Upload signed contract files (images/PDF)
router.post(
  "/final-contracts/:id/upload",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(finalContractParamsSchema),
  uploadFinalContractFiles,
  asyncHandler(uploadFiles)
);

// (Removed) approve route: upload now finalizes contract (SIGNED)

// Remaining balance after deposit
router.get(
  "/final-contracts/:id/remaining",
  authenticateToken,
  validateParams(finalContractParamsSchema),
  asyncHandler(getRemainingAmount)
);

// Admin/Staff delete a final contract and attached files
router.delete(
  "/final-contracts/:id",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(finalContractParamsSchema),
  asyncHandler(deleteFinalContractById)
);

// Admin/Staff delete a single file from final contract
router.delete(
  "/final-contracts/:id/files/:type/:index",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(deleteFileParamsSchema),
  asyncHandler(deleteFileFromFinalContract)
);

// Assign tenant to final contract
router.put(
  "/final-contracts/:id/assign-tenant",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(finalContractParamsSchema),
  validateBody(assignTenantSchema),
  asyncHandler(assignTenantToFinalContract)
);

// View file inline (proxy for PDF viewing)
router.get(
  "/final-contracts/:id/view/:type/:index",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { viewFileInline } = await import("../controllers/finalContract.controller.js");
    return viewFileInline(req, res);
  })
);

// Create FinalContract for co-tenant (Admin only)
router.post(
  "/final-contracts/create-for-cotenant",
  authenticateToken,
  authorize('ADMIN'),
  asyncHandler(createForCoTenant)
);

// Cancel FinalContract (Admin only)
router.put(
  "/final-contracts/:id/cancel",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(finalContractParamsSchema),
  asyncHandler(cancelFinalContract)
);

export default router;