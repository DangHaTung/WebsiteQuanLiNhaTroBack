import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// Get all notifications (authenticated user)
router.get("/", authenticateToken, asyncHandler(getNotifications));

// Get unread count
router.get("/unread/count", authenticateToken, asyncHandler(getUnreadCount));

// Mark notification as read
router.put("/:id/read", authenticateToken, asyncHandler(markAsRead));

// Mark all as read
router.put("/read/all", authenticateToken, asyncHandler(markAllAsRead));

// Delete notification
router.delete("/:id", authenticateToken, asyncHandler(deleteNotification));

export default router;



