import notificationService from '../services/notification/notification.service.js';

/**
 * GET /api/notifications
 * Lấy danh sách thông báo của user
 */
export const getNotifications = async (req, res) => {
  try {
    // Debug: Log user info
    console.log('[getNotifications] req.user:', req.user ? { _id: req.user._id, role: req.user.role } : 'null');
    console.log('[getNotifications] headers.authorization:', req.headers.authorization ? 'present' : 'missing');
    
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'Chưa xác thực - req.user không tồn tại',
      });
    }
    
    const userId = req.user._id;
    const { page = 1, limit = 20, isRead, type } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : null,
      type,
    });

    res.json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách thông báo',
      error: error.message,
    });
  }
};

/**
 * GET /api/notifications/unread-count
 * Đếm số thông báo chưa đọc
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đếm thông báo chưa đọc',
      error: error.message,
    });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Đánh dấu thông báo đã đọc
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Đã đánh dấu thông báo đã đọc',
      data: notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi đánh dấu thông báo đã đọc',
      error: error.message,
    });
  }
};

/**
 * PUT /api/notifications/read-all
 * Đánh dấu tất cả thông báo đã đọc
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo đã đọc',
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đánh dấu tất cả thông báo đã đọc',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/notifications/:id
 * Xóa thông báo
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Đã xóa thông báo',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi xóa thông báo',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/notifications/read-all
 * Xóa tất cả thông báo đã đọc
 */
export const deleteAllRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.deleteAllRead(userId);

    res.json({
      success: true,
      message: 'Đã xóa tất cả thông báo đã đọc',
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa thông báo đã đọc',
      error: error.message,
    });
  }
};

/**
 * POST /api/notifications/test
 * Test tạo thông báo (Admin only - for testing)
 */
export const testCreateNotification = async (req, res) => {
  try {
    const { userId, type, title, message, priority } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin: userId, type, title, message',
      });
    }

    const notification = await notificationService.createNotification({
      userId,
      type,
      title,
      message,
      priority: priority || 'MEDIUM',
    });

    res.json({
      success: true,
      message: 'Đã tạo thông báo test',
      data: notification,
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo thông báo test',
      error: error.message,
    });
  }
};
