import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validation.middleware.js";
import {
  getAllFees,
  getFeeById,
  createFee,
  updateFee,
  deleteFee,
  calculateElectricity,
} from "../controllers/utilityFee.controller.js";
import {
  createFeeSchema,
  updateFeeSchema,
  feeParamsSchema,
  feeQuerySchema,
  electricityCalcSchema,
} from "../validations/utilityFee.validation.js";

const router = express.Router();

// ADMIN/STAFF routes
router.get(
  "/fees",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateQuery(feeQuerySchema),
  asyncHandler(getAllFees)
);

router.get(
  "/fees/:id",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateParams(feeParamsSchema),
  asyncHandler(getFeeById)
);

router.post(
  "/fees",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateBody(createFeeSchema),
  asyncHandler(createFee)
);

router.put(
  "/fees/:id",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateParams(feeParamsSchema),
  validateBody(updateFeeSchema),
  asyncHandler(updateFee)
);

router.delete(
  "/fees/:id",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateParams(feeParamsSchema),
  asyncHandler(deleteFee)
);

// Electricity calculator endpoint
router.post(
  "/fees/electricity/calculate",
  authenticateToken,
  authorize("ADMIN", "STAFF"),
  validateBody(electricityCalcSchema),
  asyncHandler(calculateElectricity)
);

export default router;