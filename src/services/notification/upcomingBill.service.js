// Service gửi thông báo trước khi tạo hóa đơn hàng tháng
import moment from 'moment';
import Contract from '../../models/contract.model.js';
import { emitToUser, emitToAdmins } from '../socket/socket.service.js';
import { sendEmailNotification } from '../email/notification.service.js';
import notificationService from './notification.service.js';

const toNum = (d) => (d === null || d === undefined ? 0 : parseFloat(d.toString()));

/**
 * Gửi thông báo trước khi tạo hóa đơn cho một hợp đồng
 * @param {Object} contract - Hợp đồng
 * @param {number} daysUntilBilling - Số ngày còn lại đến ngày tạo hóa đơn
 * @param {Date} billingDate - Ngày sẽ tạo hóa đơn
 */
export async function sendUpcomingBillNotification(contract, daysUntilBilling, billingDate) {
  try {
    const tenant = contract.tenantId;
    const room = contract.roomId;

    if (!tenant || !room) {
      console.log(`⚠️  Thiếu thông tin tenant hoặc room cho contract ${contract._id}`);
      return;
    }

    const monthlyRent = toNum(contract.monthlyRent);
    const billingMonth = moment(billingDate).format('MM/YYYY');
    const billingDateFormatted = moment(billingDate).format('DD/MM/YYYY');

    // Tạo thông báo
    const notification = {
      type: 'UPCOMING_BILL',
      contractId: contract._id,
      roomNumber: room.roomNumber,
      tenantId: tenant._id,
      tenantName: tenant.fullName,
      billingDate: billingDate,
      daysUntilBilling,
      estimatedAmount: monthlyRent,
      message: daysUntilBilling === 0
        ? `Hóa đơn tháng ${billingMonth} cho phòng ${room.roomNumber} sẽ được tạo hôm nay. Dự kiến: ${monthlyRent.toLocaleString('vi-VN')} VNĐ`
        : `Hóa đơn tháng ${billingMonth} cho phòng ${room.roomNumber} sẽ được tạo vào ngày ${billingDateFormatted} (còn ${daysUntilBilling} ngày). Dự kiến: ${monthlyRent.toLocaleString('vi-VN')} VNĐ`,
      timestamp: new Date(),
    };

    // Gửi thông báo real-time đến tenant
    emitToUser(tenant._id.toString(), 'upcoming-bill', notification);
    console.log(`📤 Đã gửi thông báo hóa đơn sắp tới cho tenant ${tenant.fullName}`);

    // Gửi thông báo đến admin
    const adminNotification = {
      ...notification,
      message: `Tenant ${tenant.fullName} (Phòng ${room.roomNumber}) sẽ có hóa đơn mới vào ${billingDateFormatted} (còn ${daysUntilBilling} ngày)`,
    };
    emitToAdmins('upcoming-bill-admin', adminNotification);
    console.log(`📤 Đã gửi thông báo hóa đơn sắp tới cho admin`);

    // Gửi email nếu tenant có email
    if (tenant.email) {
      await sendUpcomingBillEmail(tenant, room, contract, daysUntilBilling, billingDate, monthlyRent);
    }

    // Lưu vào hệ thống Notification + phát new-notification để client hiển thị trong bell/list
    try {
      await notificationService.createNotification({
        userId: tenant._id,
        type: 'UPCOMING_BILL',
        title: daysUntilBilling === 0
          ? `Hóa đơn tháng ${billingMonth} sẽ được tạo hôm nay`
          : `Hóa đơn tháng ${billingMonth} sắp được tạo`,
        message: daysUntilBilling === 0
          ? `Hôm nay sẽ tạo hóa đơn tháng ${billingMonth} cho phòng ${room.roomNumber}.`
          : `Hóa đơn tháng ${billingMonth} sẽ được tạo vào ngày ${billingDateFormatted} (còn ${daysUntilBilling} ngày).`,
        relatedEntity: 'CONTRACT',
        relatedEntityId: contract._id,
        metadata: {
          roomNumber: room.roomNumber,
          billingDate,
          daysUntilBilling,
          estimatedRent: monthlyRent,
        },
        priority: daysUntilBilling <= 2 ? 'HIGH' : 'MEDIUM',
        actionUrl: '/invoices',
      });
    } catch (err) {
      console.error('❌ Lỗi khi tạo Notification UPCOMING_BILL:', err.message);
    }

    return notification;
  } catch (error) {
    console.error('❌ Lỗi khi gửi thông báo hóa đơn sắp tới:', error);
    throw error;
  }
}

/**
 * Gửi email thông báo hóa đơn sắp tới
 */
async function sendUpcomingBillEmail(tenant, room, contract, daysUntilBilling, billingDate, estimatedAmount) {
  try {
    const billingMonth = moment(billingDate).format('MM/YYYY');
    const billingDateFormatted = moment(billingDate).format('DD/MM/YYYY');
    
    const subject = daysUntilBilling === 0
      ? `Thông báo: Hóa đơn tháng ${billingMonth} sẽ được tạo hôm nay`
      : `Nhắc nhở: Hóa đơn tháng ${billingMonth} sẽ được tạo vào ngày ${billingDateFormatted}`;

    const urgencyColor = daysUntilBilling <= 2 ? '#ffc107' : '#17a2b8';

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
          .highlight { background-color: #fff3cd; padding: 10px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📅 Thông báo Hóa đơn Sắp tới</h2>
          </div>
          <div class="content">
            <p>Xin chào <strong>${tenant.fullName}</strong>,</p>
            
            <p>${daysUntilBilling === 0
              ? `Hóa đơn tiền thuê phòng tháng ${billingMonth} của bạn sẽ được tạo <strong>hôm nay</strong>.`
              : `Đây là thông báo nhắc nhở về hóa đơn tiền thuê phòng tháng ${billingMonth} sẽ được tạo vào <strong>ngày ${billingDateFormatted}</strong> (còn <strong>${daysUntilBilling} ngày</strong>).`
            }</p>
            
            <div class="info-box">
              <h3>Thông tin dự kiến:</h3>
              <ul style="list-style: none; padding: 0;">
                <li>📍 <strong>Phòng:</strong> ${room.roomNumber}</li>
                <li>📅 <strong>Tháng:</strong> ${billingMonth}</li>
                <li>📆 <strong>Ngày tạo hóa đơn:</strong> ${billingDateFormatted}</li>
                <li>💰 <strong>Tiền thuê phòng:</strong> <span class="amount">${estimatedAmount.toLocaleString('vi-VN')} VNĐ</span></li>
              </ul>
            </div>
            
            <div class="highlight">
              <strong>📝 Lưu ý:</strong> Số tiền trên chỉ là tiền thuê phòng cơ bản. Hóa đơn thực tế sẽ bao gồm thêm các khoản phí dịch vụ (điện, nước, internet, v.v.) dựa trên mức tiêu thụ thực tế của bạn.
            </div>
            
            <p>Vui lòng chuẩn bị sẵn sàng để thanh toán khi hóa đơn được tạo. Bạn có thể đăng nhập vào hệ thống để xem chi tiết hóa đơn và thanh toán online.</p>
            
            ${daysUntilBilling <= 2 ? `
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 5px;">
                <strong>⏰ Sắp đến hạn:</strong> Hóa đơn sẽ được tạo trong ${daysUntilBilling} ngày tới. Vui lòng chuẩn bị thanh toán đúng hạn để tránh phát sinh phí phạt.
              </div>
            ` : ''}
            
            <p style="margin-top: 20px;">Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi.</p>
            
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

    console.log(`✅ Đã gửi email thông báo hóa đơn sắp tới đến ${tenant.email}`);
  } catch (error) {
    console.error('❌ Lỗi khi gửi email thông báo hóa đơn sắp tới:', error.message);
  }
}

/**
 * Quét và gửi thông báo cho tất cả hợp đồng active về hóa đơn sắp tới
 * @param {number} daysBeforeBilling - Số ngày trước ngày tạo hóa đơn
 * @param {Date} billingDate - Ngày sẽ tạo hóa đơn
 */
export async function scanAndSendUpcomingBillNotifications(daysBeforeBilling, billingDate) {
  try {
    console.log(`\n🔍 Bắt đầu gửi thông báo hóa đơn sắp tới (${daysBeforeBilling} ngày trước ngày ${moment(billingDate).format('DD/MM/YYYY')})...`);

    // Tìm tất cả hợp đồng ACTIVE
    const activeContracts = await Contract.find({ status: 'ACTIVE' })
      .populate('tenantId', 'fullName email phone')
      .populate('roomId', 'roomNumber');

    const results = {
      total: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const contract of activeContracts) {
      // Bỏ qua nếu không có tenant hoặc room
      if (!contract.tenantId || !contract.roomId) {
        results.skipped++;
        continue;
      }

      results.total++;

      try {
        await sendUpcomingBillNotification(contract, daysBeforeBilling, billingDate);
        results.sent++;
        results.details.push({
          contractId: contract._id,
          roomNumber: contract.roomId.roomNumber,
          tenantName: contract.tenantId.fullName,
          status: 'sent',
        });
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý contract ${contract._id}:`, error.message);
        results.errors++;
        results.details.push({
          contractId: contract._id,
          roomNumber: contract.roomId?.roomNumber,
          error: error.message,
          status: 'error',
        });
      }
    }

    console.log(`✅ Hoàn tất gửi thông báo hóa đơn sắp tới:`);
    console.log(`   - Tổng số hợp đồng: ${results.total}`);
    console.log(`   - Đã gửi: ${results.sent}`);
    console.log(`   - Bỏ qua: ${results.skipped}`);
    console.log(`   - Lỗi: ${results.errors}`);

    return results;
  } catch (error) {
    console.error('❌ Lỗi khi quét hợp đồng:', error);
    throw error;
  }
}

export default {
  sendUpcomingBillNotification,
  scanAndSendUpcomingBillNotifications,
};
