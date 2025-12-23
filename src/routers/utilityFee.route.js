import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validation.middleware.js";
import {
  getAllUtilityFees,
  getUtilityFeeByType,
  createOrUpdateUtilityFee,
  deleteUtilityFee,
} from "../controllers/utilityFee.controller.js";
// Validation schemas removed for simplicity - can add later if needed

const router = express.Router();

// ADMIN routes
router.get(
  "/utility-fees",
  authenticateToken,
  authorize("ADMIN"),
  asyncHandler(getAllUtilityFees)
);

router.get(
  "/utility-fees/:type",
  authenticateToken,
  authorize("ADMIN"),
  asyncHandler(getUtilityFeeByType)
);

router.post(
  "/utility-fees",
  authenticateToken,
  authorize("ADMIN"),
  asyncHandler(createOrUpdateUtilityFee)
);

router.delete(
  "/utility-fees/:id",
  authenticateToken,
  authorize("ADMIN"),
  asyncHandler(deleteUtilityFee)
);

export default router;