// Service gửi thông báo nhắc nhở thanh toán tiền thuê
import moment from 'moment';
import Bill from '../../models/bill.model.js';
import Contract from '../../models/contract.model.js';
import { emitToUser, emitToAdmins } from '../socket/socket.service.js';
import { sendEmailNotification } from '../email/notification.service.js';

const toNum = (d) => (d === null || d === undefined ? 0 : parseFloat(d.toString()));

/**
 * Gửi thông báo nhắc nhở thanh toán cho một hóa đơn cụ thể
 * @param {Object} bill - Hóa đơn cần nhắc nhở
 * @param {number} daysUntilDue - Số ngày còn lại đến hạn thanh toán
 */
export async function sendRentReminderForBill(bill, daysUntilDue) {
  try {
    // Populate thông tin contract và tenant
    const populatedBill = await Bill.findById(bill._id)
      .populate({
        path: 'contractId',
        populate: [
          { path: 'tenantId', select: 'fullName email phone role' },
          { path: 'roomId', select: 'roomNumber' }
        ]
      });

    if (!populatedBill || !populatedBill.contractId) {
      console.log(`⚠️  Không tìm thấy thông tin hợp đồng cho bill ${bill._id}`);
      return;
    }

    const contract = populatedBill.contractId;
    const tenant = contract.tenantId;
    const room = contract.roomId;

    if (!tenant || !room) {
      console.log(`⚠️  Thiếu thông tin tenant hoặc room cho bill ${bill._id}`);
      return;
    }

    const amountDue = toNum(populatedBill.amountDue);
    const amountPaid = toNum(populatedBill.amountPaid);
    const remaining = amountDue - amountPaid;

    // Tạo thông báo
    const notification = {
      type: 'RENT_REMINDER',
      billId: populatedBill._id,
      contractId: contract._id,
      roomNumber: room.roomNumber,
      tenantId: tenant._id,
      tenantName: tenant.fullName,
      billingDate: populatedBill.billingDate,
      dueDate: moment(populatedBill.billingDate).add(7, 'days').toDate(), // Giả sử hạn thanh toán là 7 ngày sau ngày lập
      daysUntilDue,
      amountDue,
      amountPaid,
      remaining,
      status: populatedBill.status,
      message: daysUntilDue > 0 
        ? `Hóa đơn phòng ${room.roomNumber} sẽ đến hạn trong ${daysUntilDue} ngày. Số tiền cần thanh toán: ${remaining.toLocaleString('vi-VN')} VNĐ`
        : `Hóa đơn phòng ${room.roomNumber} đã đến hạn thanh toán. Số tiền cần thanh toán: ${remaining.toLocaleString('vi-VN')} VNĐ`,
      timestamp: new Date(),
    };

    // Gửi thông báo real-time đến tenant
    emitToUser(tenant._id.toString(), 'rent-reminder', notification);
    console.log(`📤 Đã gửi thông báo real-time đến tenant ${tenant.fullName}`);

    // Gửi thông báo đến admin
    const adminNotification = {
      ...notification,
      message: `Tenant ${tenant.fullName} (Phòng ${room.roomNumber}) có hóa đơn ${daysUntilDue > 0 ? `sẽ đến hạn trong ${daysUntilDue} ngày` : 'đã đến hạn'}`,
    };
    emitToAdmins('rent-reminder-admin', adminNotification);
    console.log(`📤 Đã gửi thông báo real-time đến admin`);

    // Gửi email nếu tenant có email
    if (tenant.email) {
      await sendReminderEmail(tenant, room, populatedBill, daysUntilDue, remaining);
    }

    return notification;
  } catch (error) {
    console.error('❌ Lỗi khi gửi thông báo nhắc nhở:', error);
    throw error;
  }
}

/**
 * Gửi email nhắc nhở thanh toán
 */
async function sendReminderEmail(tenant, room, bill, daysUntilDue, remaining) {
  try {
    const billingMonth = moment(bill.billingDate).format('MM/YYYY');
    const dueDate = moment(bill.billingDate).add(7, 'days').format('DD/MM/YYYY');
    
    const subject = daysUntilDue > 0
      ? `Nhắc nhở: Hóa đơn tháng ${billingMonth} sẽ đến hạn trong ${daysUntilDue} ngày`
      : `Cảnh báo: Hóa đơn tháng ${billingMonth} đã đến hạn thanh toán`;

    const urgencyClass = daysUntilDue <= 1 ? 'urgent' : daysUntilDue <= 3 ? 'warning' : 'info';
    const urgencyColor = daysUntilDue <= 1 ? '#dc3545' : daysUntilDue <= 3 ? '#ffc107' : '#17a2b8';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${urgencyColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${urgencyColor}; }
          .amount { font-size: 24px; font-weight: bold; color: ${urgencyColor}; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background-color: ${urgencyColor}; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${daysUntilDue > 0 ? '⏰ Nhắc nhở thanh toán' : '⚠️ Cảnh báo thanh toán'}</h2>
          </div>
          <div class="content">
            <p>Xin chào <strong>${tenant.fullName}</strong>,</p>
            
            <p>${daysUntilDue > 0 
              ? `Đây là thông báo nhắc nhở về hóa đơn tiền thuê phòng của bạn sẽ đến hạn trong <strong>${daysUntilDue} ngày</strong>.`
              : `Hóa đơn tiền thuê phòng của bạn <strong>đã đến hạn thanh toán</strong>. Vui lòng thanh toán ngay để tránh phát sinh phí phạt.`
            }</p>
            
            <div class="info-box">
              <h3>Thông tin hóa đơn:</h3>
              <ul style="list-style: none; padding: 0;">
                <li>📍 <strong>Phòng:</strong> ${room.roomNumber}</li>
                <li>📅 <strong>Tháng:</strong> ${billingMonth}</li>
                <li>⏰ <strong>Hạn thanh toán:</strong> ${dueDate}</li>
                <li>💰 <strong>Số tiền cần thanh toán:</strong> <span class="amount">${remaining.toLocaleString('vi-VN')} VNĐ</span></li>
                <li>📊 <strong>Trạng thái:</strong> ${bill.status === 'UNPAID' ? 'Chưa thanh toán' : bill.status === 'PARTIALLY_PAID' ? 'Thanh toán một phần' : bill.status}</li>
              </ul>
            </div>
            
            <p><strong>Vui lòng đăng nhập vào hệ thống để xem chi tiết và thanh toán:</strong></p>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/bills/${bill._id}" class="button">
                Xem chi tiết hóa đơn
              </a>
            </div>
            
            ${daysUntilDue <= 1 ? `
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 5px;">
                <strong>⚠️ Lưu ý:</strong> Nếu không thanh toán đúng hạn, bạn có thể bị tính phí phạt chậm thanh toán theo quy định.
              </div>
            ` : ''}
            
            <p style="margin-top: 20px;">Nếu bạn đã thanh toán, vui lòng bỏ qua email này hoặc liên hệ với chúng tôi để xác nhận.</p>
            
            <p>Trân trọng,<br><strong>Ban quản lý</strong></p>
          </div>
          <div class="footer">
            <p>Email tự động từ Ban Quản lý Phòng Tro360</p>
            <p>Vui lòng không trả lời email này</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailNotification({
      to: tenant.email,
      subject,
      html,
    });

    console.log(`✅ Đã gửi email nhắc nhở đến ${tenant.email}`);
  } catch (error) {
    console.error('❌ Lỗi khi gửi email nhắc nhở:', error.message);
  }
}

/**
 * Quét và gửi thông báo cho tất cả hóa đơn sắp đến hạn
 * @param {number} daysBeforeDue - Số ngày trước hạn thanh toán để gửi thông báo (mặc định: 3 ngày)
 */
export async function scanAndSendRentReminders(daysBeforeDue = 3) {
  try {
    console.log(`\n🔍 Bắt đầu quét hóa đơn sắp đến hạn (${daysBeforeDue} ngày trước)...`);

    // Tìm tất cả hóa đơn UNPAID hoặc PARTIALLY_PAID
    const unpaidBills = await Bill.find({
      status: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
      billType: 'MONTHLY',
    }).populate({
      path: 'contractId',
      match: { status: 'ACTIVE' },
      populate: [
        { path: 'tenantId', select: 'fullName email phone' },
        { path: 'roomId', select: 'roomNumber' }
      ]
    });

    const results = {
      total: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const bill of unpaidBills) {
      // Bỏ qua nếu không có contract (đã bị xóa hoặc không active)
      if (!bill.contractId) {
        results.skipped++;
        continue;
      }

      results.total++;

      try {
        // Tính số ngày còn lại đến hạn thanh toán (giả sử hạn là 7 ngày sau ngày lập)
        const dueDate = moment(bill.billingDate).add(7, 'days');
        const today = moment().startOf('day');
        const daysUntilDue = dueDate.diff(today, 'days');

        // Chỉ gửi thông báo nếu:
        // 1. Còn đúng X ngày (daysBeforeDue) đến hạn
        // 2. Hoặc đã quá hạn (daysUntilDue < 0)
        const shouldSend = daysUntilDue === daysBeforeDue || daysUntilDue <= 0;

        if (shouldSend) {
          await sendRentReminderForBill(bill, daysUntilDue);
          results.sent++;
          results.details.push({
            billId: bill._id,
            roomNumber: bill.contractId.roomId?.roomNumber,
            tenantName: bill.contractId.tenantId?.fullName,
            daysUntilDue,
            status: 'sent',
          });
        } else {
          results.skipped++;
        }
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý bill ${bill._id}:`, error.message);
        results.errors++;
        results.details.push({
          billId: bill._id,
          error: error.message,
          status: 'error',
        });
      }
    }

    console.log(`✅ Hoàn tất quét hóa đơn:`);
    console.log(`   - Tổng số: ${results.total}`);
    console.log(`   - Đã gửi: ${results.sent}`);
    console.log(`   - Bỏ qua: ${results.skipped}`);
    console.log(`   - Lỗi: ${results.errors}`);

    return results;
  } catch (error) {
    console.error('❌ Lỗi khi quét hóa đơn:', error);
    throw error;
  }
}

/**
 * Gửi thông báo khi có hóa đơn mới được tạo
 * @param {Object} bill - Hóa đơn mới
 * @param {Object} tenant - Thông tin tenant
 * @param {Object} room - Thông tin phòng
 */
export async function sendNewBillNotification(bill, tenant, room) {
  try {
    const amountDue = toNum(bill.amountDue);
    const billingMonth = moment(bill.billingDate).format('MM/YYYY');

    const notification = {
      type: 'NEW_BILL',
      billId: bill._id,
      roomNumber: room.roomNumber,
      tenantId: tenant._id,
      tenantName: tenant.fullName,
      billingDate: bill.billingDate,
      amountDue,
      status: bill.status,
      message: `Hóa đơn tháng ${billingMonth} cho phòng ${room.roomNumber} đã được tạo. Số tiền: ${amountDue.toLocaleString('vi-VN')} VNĐ`,
      timestamp: new Date(),
    };

    // Gửi đến tenant
    if (tenant._id) {
      emitToUser(tenant._id.toString(), 'new-bill', notification);
      console.log(`📤 Đã gửi thông báo hóa đơn mới đến tenant ${tenant.fullName}`);
    }

    // Gửi đến admin
    emitToAdmins('new-bill-admin', notification);
    console.log(`📤 Đã gửi thông báo hóa đơn mới đến admin`);

    // Gửi email
    if (tenant.email) {
      const subject = `Hóa đơn tháng ${billingMonth} - Phòng ${room.roomNumber}`;
      const html = `
        <h2>Thông báo hóa đơn mới</h2>
        <p>Xin chào <strong>${tenant.fullName}</strong>,</p>
        <p>Hóa đơn tháng ${billingMonth} của bạn đã được tạo.</p>
        <h3>Thông tin hóa đơn:</h3>
        <ul>
          <li><strong>Phòng:</strong> ${room.roomNumber}</li>
          <li><strong>Ngày lập:</strong> ${moment(bill.billingDate).format('DD/MM/YYYY')}</li>
          <li><strong>Tổng tiền:</strong> ${amountDue.toLocaleString('vi-VN')} VNĐ</li>
          <li><strong>Hạn thanh toán:</strong> ${moment(bill.billingDate).add(7, 'days').format('DD/MM/YYYY')}</li>
        </ul>
        <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và thanh toán.</p>
        <p><em>Trân trọng,<br>Ban quản lý</em></p>
      `;
      
      await sendEmailNotification({
        to: tenant.email,
        subject,
        html,
      });
    }

    return notification;
  } catch (error) {
    console.error('❌ Lỗi khi gửi thông báo hóa đơn mới:', error);
  }
}

export default {
  sendRentReminderForBill,
  scanAndSendRentReminders,
  sendNewBillNotification,
};
