// Router cho notification và testing Socket.io
import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import { 
  getOnlineUsersCount, 
  getOnlineUserIds, 
  emitToUser, 
  emitToAdmins, 
  emitToTenants,
  broadcastToAll 
} from '../services/socket/socket.service.js';
import { 
  scanAndSendRentReminders, 
  sendRentReminderForBill 
} from '../services/notification/rentReminder.service.js';
import { scanAndSendUpcomingBillNotifications } from '../services/notification/upcomingBill.service.js';
import Bill from '../models/bill.model.js';
import moment from 'moment';

const router = express.Router();

/**
 * GET /api/notifications/status
 * Kiểm tra trạng thái Socket.io server
 */
router.get('/status', authenticateToken, authorize('ADMIN'), (req, res) => {
  try {
    const onlineCount = getOnlineUsersCount();
    const onlineUserIds = getOnlineUserIds();
    
    res.json({
      success: true,
      data: {
        socketIOActive: true,
        onlineUsersCount: onlineCount,
        onlineUserIds,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy trạng thái Socket.io',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/test/user
 * Test gửi thông báo đến một user cụ thể (Admin only)
 */
router.post('/test/user', authenticateToken, authorize('ADMIN'), (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu userId hoặc message',
      });
    }
    
    emitToUser(userId, 'test-notification', {
      message,
      timestamp: new Date(),
      from: 'Admin',
    });
    
    res.json({
      success: true,
      message: `Đã gửi thông báo test đến user ${userId}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi thông báo test',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/test/admins
 * Test gửi thông báo đến tất cả Admin (Admin only)
 */
router.post('/test/admins', authenticateToken, authorize('ADMIN'), (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu message',
      });
    }
    
    emitToAdmins('test-notification', {
      message,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Đã gửi thông báo test đến tất cả Admin',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi thông báo test',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/test/tenants
 * Test gửi thông báo đến tất cả Tenant (Admin only)
 */
router.post('/test/tenants', authenticateToken, authorize('ADMIN'), (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu message',
      });
    }
    
    emitToTenants('test-notification', {
      message,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Đã gửi thông báo test đến tất cả Tenant',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi thông báo test',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/test/broadcast
 * Test broadcast thông báo đến tất cả (Admin only)
 */
router.post('/test/broadcast', authenticateToken, authorize('ADMIN'), (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu message',
      });
    }
    
    broadcastToAll('test-notification', {
      message,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Đã broadcast thông báo test đến tất cả',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi broadcast thông báo test',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/rent-reminder/scan
 * Quét và gửi thông báo nhắc nhở thanh toán thủ công (Admin only)
 */
router.post('/rent-reminder/scan', authenticateToken, authorize('ADMIN'), async (req, res) => {
  try {
    const { daysBeforeDue = 3 } = req.body;
    
    const results = await scanAndSendRentReminders(daysBeforeDue);
    
    res.json({
      success: true,
      message: 'Đã quét và gửi thông báo nhắc nhở',
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi quét và gửi thông báo',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/rent-reminder/bill/:billId
 * Gửi thông báo nhắc nhở cho một hóa đơn cụ thể (Admin only)
 */
router.post('/rent-reminder/bill/:billId', authenticateToken, authorize('ADMIN'), async (req, res) => {
  try {
    const { billId } = req.params;
    const { daysUntilDue = 3 } = req.body;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hóa đơn',
      });
    }
    
    const notification = await sendRentReminderForBill(bill, daysUntilDue);
    
    res.json({
      success: true,
      message: 'Đã gửi thông báo nhắc nhở',
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi thông báo',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/upcoming-bill/scan
 * Gửi thông báo hóa đơn sắp tới thủ công (Admin only)
 */
router.post('/upcoming-bill/scan', authenticateToken, authorize('ADMIN'), async (req, res) => {
  try {
    const { daysBeforeBilling } = req.body;
    const billingDay = parseInt(process.env.MONTHLY_BILLING_DAY || '5');
    
    // Tính ngày tạo hóa đơn: nếu hôm nay đã qua ngày billingDay tháng này => chọn ngày billingDay tháng sau
    const today = moment().startOf('day');
    let billingDateMoment = moment().date(billingDay).startOf('day');
    if (today.isAfter(billingDateMoment)) {
      billingDateMoment = billingDateMoment.add(1, 'month');
    }
    const billingDate = billingDateMoment.toDate();
    
    // Số ngày còn lại đến ngày tạo hóa đơn
    const calculatedDays = daysBeforeBilling ?? billingDateMoment.diff(today, 'days');
    
    const results = await scanAndSendUpcomingBillNotifications(calculatedDays, billingDate);
    
    res.json({
      success: true,
      message: 'Đã gửi thông báo hóa đơn sắp tới',
      data: {
        ...results,
        billingDate: moment(billingDate).format('DD/MM/YYYY'),
        daysUntilBilling: calculatedDays,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi thông báo hóa đơn sắp tới',
      error: error.message,
    });
  }
});

export default router;
