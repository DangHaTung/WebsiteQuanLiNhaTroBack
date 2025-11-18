import express from "express";
import {
  createMoveOutRequest,
  getMyMoveOutRequests,
  getAllMoveOutRequests,
  updateMoveOutRequestStatus,
  completeMoveOutRequest,
} from "../controllers/moveOutRequest.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { validateBody, validateParams } from "../middleware/validation.middleware.js";
import {
  createMoveOutRequestSchema,
  updateMoveOutRequestStatusSchema,
  moveOutRequestParamsSchema,
} from "../validations/moveOutRequest.validation.js";

const router = express.Router();

// Client routes
router.post(
  "/move-out-requests",
  authenticateToken,
  validateBody(createMoveOutRequestSchema),
  asyncHandler(createMoveOutRequest)
);
router.get("/move-out-requests/my", authenticateToken, asyncHandler(getMyMoveOutRequests));

// Admin routes
router.get("/move-out-requests", authenticateToken, authorize("ADMIN"), asyncHandler(getAllMoveOutRequests));
router.put(
  "/move-out-requests/:id",
  authenticateToken,
  authorize("ADMIN"),
  validateParams(moveOutRequestParamsSchema),
  validateBody(updateMoveOutRequestStatusSchema),
  asyncHandler(updateMoveOutRequestStatus)
);
router.put(
  "/move-out-requests/:id/complete",
  authenticateToken,
  authorize("ADMIN"),
  validateParams(moveOutRequestParamsSchema),
  asyncHandler(completeMoveOutRequest)
);

export default router;

