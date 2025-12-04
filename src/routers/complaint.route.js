import express from "express";
import {
  getAllComplaints,
  updateComplaintStatus,
  deleteComplaint,
} from "../controllers/complaint.controller.js";

import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

import {
  updateComplaintStatusSchema,
  forbidInvalidStatusTransition,
} from "../validations/complaint.validation.js";

const router = express.Router();

// Test ping
router.get("/_ping", (req, res) => res.json({ ok: true, message: "complaint admin route alive" }));

// Get all complaints (ADMIN)
router.get(
  "/",
  authenticateToken,
  authorize("ADMIN"),
  asyncHandler(getAllComplaints)
);

// Update complaint status (ADMIN ONLY)
router.put(
  "/:id/status",
  authenticateToken,
  authorize("ADMIN"),
  forbidInvalidStatusTransition,
  validateBody(updateComplaintStatusSchema),
  asyncHandler(updateComplaintStatus)
);

// Delete complaint (ADMIN ONLY)
router.delete(
  "/:id",
  authenticateToken,
  authorize("ADMIN"),
  asyncHandler(deleteComplaint)
);

export default router;
