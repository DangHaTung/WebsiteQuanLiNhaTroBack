import express from "express";
import {
  createComplaint,
  getComplaintsByTenantId,
  getComplaintById,
  deleteComplaint,
} from "../controllers/complaint.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

import {
  createComplaintSchema,
} from "../validations/complaint.validation.js";

const router = express.Router();

// Create complaint (khách hàng đã đăng nhập)
router.post(
  "/",
  authenticateToken,
  validateBody(createComplaintSchema),
  asyncHandler(createComplaint)
);

// Get complaints by tenantId (khách hàng xem complaints của mình)
router.get(
  "/tenant/:tenantId",
  authenticateToken,
  asyncHandler(getComplaintsByTenantId)
);

// Get complaint by id (user xem complaint của mình)
router.get(
  "/:id",
  authenticateToken,
  asyncHandler(getComplaintById)
);

// Delete complaint (user xóa complaint của mình)
router.delete(
  "/:id",
  authenticateToken,
  asyncHandler(deleteComplaint)
);

export default router;


