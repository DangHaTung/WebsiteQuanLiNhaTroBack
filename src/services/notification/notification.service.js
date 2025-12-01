import Notification from '../../models/notification.model.js';
import { emitToUser } from '../socket/socket.service.js';

/**
 * Notification Service - Quản lý thông báo cho người dùng
 */

class NotificationService {
  /**
   * Tạo thông báo mới và gửi real-time qua Socket.IO
   * @param {Object} params - Thông tin thông báo
   * @returns {Promise<Notification>}
   */
  async createNotification({
    userId,
    type,
    title,
    message,
    relatedEntity = null,
    relatedEntityId = null,
    metadata = {},
    priority = 'MEDIUM',
    actionUrl = null,
  }) {
    try {
      // Validate required fields
      if (!userId || !type || !title || !message) {
        throw new Error('Missing required fields: userId, type, title, message');
      }

      // Tạo notification trong database
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        relatedEntity,
        relatedEntityId,
        metadata,
        priority,
        actionUrl,
        isRead: false,
      });

      // Populate user info
      await notification.populate('userId', 'fullName email');

      console.log(`📬 Notification created: ${type} for user ${userId}`);

      // Gửi real-time qua Socket.IO
      this.sendNotificationToUser(userId, notification);

      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error.message);
      throw error;
    }
  }

  /**
   * Gửi thông báo real-time qua Socket.IO
   * @param {string} userId - ID người dùng
   * @param {Object} notification - Thông báo
   */
  sendNotificationToUser(userId, notification) {
    try {
      emitToUser(userId.toString(), 'new-notification', {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          metadata: notification.metadata,
          actionUrl: notification.actionUrl,
          createdAt: notification.createdAt,
        },
      });
      console.log(`📤 Real-time notification sent to user ${userId}`);
    } catch (error) {
      console.error('❌ Error sending real-time notification:', error.message);
      // Không throw error để không block việc tạo notification
    }
  }

  /**
   * Lấy danh sách thông báo của user
   * @param {string} userId - ID người dùng
   * @param {Object} filters - Bộ lọc
   * @returns {Promise<Array>}
   */
  async getUserNotifications(userId, { page = 1, limit = 20, isRead = null, type = null } = {}) {
    try {
      const query = { userId };
      
      if (isRead !== null) {
        query.isRead = isRead;
      }
      
      if (type) {
        query.type = type;
      }

      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'fullName email'),
        Notification.countDocuments(query),
      ]);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('❌ Error getting user notifications:', error.message);
      throw error;
    }
  }

  /**
   * Đếm số thông báo chưa đọc
   * @param {string} userId - ID người dùng
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.countUnread(userId);
    } catch (error) {
      console.error('❌ Error counting unread notifications:', error.message);
      throw error;
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   * @param {string} notificationId - ID thông báo
   * @param {string} userId - ID người dùng (để verify ownership)
   * @returns {Promise<Notification>}
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        userId,
      });

      if (!notification) {
        throw new Error('Notification not found or unauthorized');
      }

      if (!notification.isRead) {
        await notification.markAsRead();
        console.log(`✅ Notification ${notificationId} marked as read`);
      }

      return notification;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error.message);
      throw error;
    }
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   * @param {string} userId - ID người dùng
   * @returns {Promise<Object>}
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.markAllAsRead(userId);
      console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      return result;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error.message);
      throw error;
    }
  }

  /**
   * Xóa thông báo
   * @param {string} notificationId - ID thông báo
   * @param {string} userId - ID người dùng (để verify ownership)
   * @returns {Promise<void>}
   */
  async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        userId,
      });

      if (result.deletedCount === 0) {
        throw new Error('Notification not found or unauthorized');
      }

      console.log(`🗑️ Notification ${notificationId} deleted`);
    } catch (error) {
      console.error('❌ Error deleting notification:', error.message);
      throw error;
    }
  }

  /**
   * Xóa tất cả thông báo đã đọc
   * @param {string} userId - ID người dùng
   * @returns {Promise<Object>}
   */
  async deleteAllRead(userId) {
    try {
      const result = await Notification.deleteMany({
        userId,
        isRead: true,
      });

      console.log(`🗑️ Deleted ${result.deletedCount} read notifications for user ${userId}`);
      return result;
    } catch (error) {
      console.error('❌ Error deleting read notifications:', error.message);
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS - Tạo thông báo cho các case cụ thể
  // ============================================

  /**
   * Thông báo hóa đơn mới được tạo
   */
  async notifyBillCreated(bill) {
    try {
      const billTypeText = {
        MONTHLY: 'hóa đơn hàng tháng',
        CONTRACT: 'hóa đơn hợp đồng',
        RECEIPT: 'phiếu thu',
      };

      const typeText = billTypeText[bill.billType] || 'hóa đơn';
      const amountFormatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(bill.transfer);

      return await this.createNotification({
        userId: bill.tenantId,
        type: 'BILL_CREATED',
        title: `${typeText.charAt(0).toUpperCase() + typeText.slice(1)} mới`,
        message: `Bạn có ${typeText} mới: ${amountFormatted}${bill.month ? ` - Tháng ${bill.month}` : ''}`,
        relatedEntity: 'BILL',
        relatedEntityId: bill._id,
        priority: 'HIGH',
        actionUrl: `/invoices/${bill._id}`,
        metadata: {
          billType: bill.billType,
          amount: bill.transfer,
          month: bill.month,
          roomNumber: bill.roomId?.roomNumber,
          dueDate: bill.dueDate,
        },
      });
    } catch (error) {
      console.error('❌ Error notifying bill created:', error.message);
    }
  }

  /**
   * Thông báo thanh toán thành công
   */
  async notifyPaymentSuccess(bill, paymentMethod) {
    try {
      const amountFormatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(bill.transfer);

      return await this.createNotification({
        userId: bill.tenantId,
        type: 'PAYMENT_SUCCESS',
        title: 'Thanh toán thành công',
        message: `Thanh toán ${amountFormatted} đã được xác nhận${bill.month ? ` - Tháng ${bill.month}` : ''}`,
        relatedEntity: 'BILL',
        relatedEntityId: bill._id,
        priority: 'MEDIUM',
        actionUrl: `/invoices/${bill._id}`,
        metadata: {
          billType: bill.billType,
          amount: bill.transfer,
          month: bill.month,
          paymentMethod,
          paidDate: bill.paidDate,
        },
      });
    } catch (error) {
      console.error('❌ Error notifying payment success:', error.message);
    }
  }

  /**
   * Thông báo hóa đơn sắp đến hạn
   */
  async notifyBillDueSoon(bill, daysRemaining) {
    try {
      const amountFormatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(bill.transfer);

      return await this.createNotification({
        userId: bill.tenantId,
        type: 'BILL_DUE_SOON',
        title: 'Hóa đơn sắp đến hạn',
        message: `Hóa đơn ${amountFormatted} sẽ đến hạn trong ${daysRemaining} ngày${bill.month ? ` - Tháng ${bill.month}` : ''}`,
        relatedEntity: 'BILL',
        relatedEntityId: bill._id,
        priority: 'HIGH',
        actionUrl: `/invoices/${bill._id}`,
        metadata: {
          billType: bill.billType,
          amount: bill.transfer,
          month: bill.month,
          dueDate: bill.dueDate,
          daysRemaining,
        },
      });
    } catch (error) {
      console.error('❌ Error notifying bill due soon:', error.message);
    }
  }

  /**
   * Thông báo hợp đồng đã ký
   */
  async notifyContractSigned(contract) {
    try {
      return await this.createNotification({
        userId: contract.tenantId,
        type: 'CONTRACT_SIGNED',
        title: 'Hợp đồng đã được ký',
        message: `Hợp đồng thuê phòng ${contract.roomId?.roomNumber || ''} đã được ký thành công`,
        relatedEntity: 'FINALCONTRACT',
        relatedEntityId: contract._id,
        priority: 'MEDIUM',
        actionUrl: `/contracts/${contract._id}`,
        metadata: {
          roomNumber: contract.roomId?.roomNumber,
          startDate: contract.startDate,
          endDate: contract.endDate,
        },
      });
    } catch (error) {
      console.error('❌ Error notifying contract signed:', error.message);
    }
  }
}

// Export singleton instance
export default new NotificationService();
