import express from "express";
import {
  checkExpiredContractsController,
  generateMonthlyBillsController,
  checkOverdueBillsController,
  checkRoomAvailabilityController,
  getSystemStatsController,
  runScheduledTasksController
} from "../controllers/business.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/security.middleware.js";

const router = express.Router();

// Tất cả routes đều cần authentication và quyền ADMIN hoặc LANDLORD
router.use(verifyToken);
router.use(requireRole("ADMIN", "LANDLORD"));

// Business logic routes
router.post("/check-expired-contracts", checkExpiredContractsController);
router.post("/generate-monthly-bills", generateMonthlyBillsController);
router.post("/check-overdue-bills", checkOverdueBillsController);
router.post("/check-room-availability", checkRoomAvailabilityController);
router.get("/system-stats", getSystemStatsController);
router.post("/run-scheduled-tasks", runScheduledTasksController);

export default router;
