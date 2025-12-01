import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  testCreateNotification,
} from '../controllers/notification.controller.js';

const router = express.Router();

// ============================================
// NOTIFICATION CRUD ROUTES
// ============================================

/**
 * GET /api/notifications-crud
 * Lấy danh sách thông báo của user hiện tại
 * Query params: page, limit, isRead, type
 */
router.get('/', authenticateToken, getNotifications);

/**
 * GET /api/notifications-crud/unread-count
 * Đếm số thông báo chưa đọc
 */
router.get('/unread-count', authenticateToken, getUnreadCount);

/**
 * PUT /api/notifications-crud/:id/read
 * Đánh dấu một thông báo đã đọc
 */
router.put('/:id/read', authenticateToken, markAsRead);

/**
 * PUT /api/notifications-crud/read-all
 * Đánh dấu tất cả thông báo đã đọc
 */
router.put('/read-all', authenticateToken, markAllAsRead);

/**
 * DELETE /api/notifications-crud/:id
 * Xóa một thông báo
 */
router.delete('/:id', authenticateToken, deleteNotification);

/**
 * DELETE /api/notifications-crud/read-all
 * Xóa tất cả thông báo đã đọc
 */
router.delete('/read-all', authenticateToken, deleteAllRead);

/**
 * POST /api/notifications-crud/test
 * Test tạo thông báo (Admin only)
 */
router.post('/test', authenticateToken, authorize('ADMIN'), testCreateNotification);

export default router;
