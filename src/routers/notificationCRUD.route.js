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
 * Cho phép cả ADMIN và TENANT (chỉ cần authenticateToken)
 * Query params: page, limit, isRead, type
 */
router.get('/', (req, res, next) => {
  console.log('[notificationCRUD.route] GET /api/notifications-crud matched');
  console.log('[notificationCRUD.route] URL:', req.url);
  console.log('[notificationCRUD.route] Method:', req.method);
  next();
}, authenticateToken, getNotifications);

/**
 * GET /api/notifications-crud/unread-count
 * Đếm số thông báo chưa đọc
 * Cho phép cả ADMIN và TENANT (chỉ cần authenticateToken)
 */
router.get('/unread-count', authenticateToken, getUnreadCount);

/**
 * PUT /api/notifications-crud/:id/read
 * Đánh dấu một thông báo đã đọc
 * Cho phép cả ADMIN và TENANT (chỉ cần authenticateToken)
 */
router.put('/:id/read', authenticateToken, markAsRead);

/**
 * PUT /api/notifications-crud/read-all
 * Đánh dấu tất cả thông báo đã đọc
 * Cho phép cả ADMIN và TENANT (chỉ cần authenticateToken)
 */
router.put('/read-all', authenticateToken, markAllAsRead);

/**
 * DELETE /api/notifications-crud/:id
 * Xóa một thông báo
 * Cho phép cả ADMIN và TENANT (chỉ cần authenticateToken)
 */
router.delete('/:id', authenticateToken, deleteNotification);

/**
 * DELETE /api/notifications-crud/read-all
 * Xóa tất cả thông báo đã đọc
 * Cho phép cả ADMIN và TENANT (chỉ cần authenticateToken)
 */
router.delete('/read-all', authenticateToken, deleteAllRead);

/**
 * POST /api/notifications-crud/test
 * Test tạo thông báo (Admin only)
 */
router.post('/test', authenticateToken, authorize('ADMIN'), testCreateNotification);

export default router;
