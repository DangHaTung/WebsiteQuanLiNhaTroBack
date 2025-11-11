import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { validateBody, validateParams } from "../middleware/validation.middleware.js";
import { assignRoomFees, getRoomFees, calculateRoomFees } from "../controllers/roomFee.controller.js";
import { assignRoomFeesSchema, roomParamsSchema, calculateRoomFeesSchema } from "../validations/roomFee.validation.js";

const router = express.Router();

// Assign fees to a room
router.post(
  "/rooms/:roomId/fees",
  authenticateToken,
authorize("ADMIN"),
  validateParams(roomParamsSchema),
  validateBody(assignRoomFeesSchema),
  asyncHandler(assignRoomFees)
);

// Get current fees for a room
router.get(
  "/rooms/:roomId/fees",
  authenticateToken,
authorize("ADMIN"),
  validateParams(roomParamsSchema),
  asyncHandler(getRoomFees)
);

// Calculate room fees
router.post(
  "/rooms/:roomId/fees/calculate",
  authenticateToken,
authorize("ADMIN"),
  validateParams(roomParamsSchema),
  validateBody(calculateRoomFeesSchema),
  asyncHandler(calculateRoomFees)
);

export default router;