// Job tự động gửi thông báo nhắc nhở thanh toán tiền thuê
import cron from 'node-cron';
import { scanAndSendRentReminders } from '../services/notification/rentReminder.service.js';
import { sendEmailNotification } from '../services/email/notification.service.js';

/**
 * Cron job tự động gửi thông báo nhắc nhở thanh toán
 * Chạy hàng ngày vào 9:00 sáng
 */
export function scheduleRentReminderJob() {
  // Cron expression: '0 9 * * *' = 09:00 hàng ngày
  const cronExpression = process.env.RENT_REMINDER_CRON || '0 9 * * *';
  const daysBeforeDue = parseInt(process.env.RENT_REMINDER_DAYS_BEFORE || '3');
  
  console.log(`📅 Đã thiết lập cron job nhắc nhở thanh toán: ${cronExpression}`);
  console.log(`   - Gửi thông báo trước ${daysBeforeDue} ngày đến hạn`);
  
  const job = cron.schedule(cronExpression, async () => {
    console.log('\n=== BẮT ĐẦU QUÉT VÀ GỬI THÔNG BÁO NHẮC NHỞ THANH TOÁN ===');
    console.log('⏰ Thời gian:', new Date().toISOString());
    
    try {
      // Quét và gửi thông báo
      const results = await scanAndSendRentReminders(daysBeforeDue);
      
      console.log('✅ Kết quả:');
      console.log(`   - Tổng số hóa đơn: ${results.total}`);
      console.log(`   - Đã gửi thông báo: ${results.sent}`);
      console.log(`   - Bỏ qua: ${results.skipped}`);
      console.log(`   - Lỗi: ${results.errors}`);
      
      // Gửi email báo cáo cho admin nếu có lỗi
      if (results.errors > 0) {
        console.log('⚠️  Có lỗi khi gửi thông báo, gửi email báo cáo...');
        await sendAdminReport(results);
      }
      
      // Log chi tiết các lỗi
      if (results.errors > 0) {
        console.log('\n❌ Danh sách lỗi:');
        results.details
          .filter(item => item.status === 'error')
          .forEach((item, index) => {
            console.log(`   ${index + 1}. Bill ${item.billId}: ${item.error}`);
          });
      }
      
      console.log('=== KẾT THÚC QUÉT VÀ GỬI THÔNG BÁO ===\n');
      
    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG khi gửi thông báo nhắc nhở:', error);
      
      // Gửi email cảnh báo cho admin
      try {
        await sendCriticalErrorNotification(error);
      } catch (emailError) {
        console.error('❌ Không thể gửi email cảnh báo:', emailError);
      }
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'
  });
  
  return job;
}

/**
 * Gửi báo cáo cho admin về kết quả gửi thông báo
 */
async function sendAdminReport(results) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('⚠️  Không có ADMIN_EMAIL trong env, bỏ qua gửi email');
      return;
    }
    
    const subject = `[Hệ thống] Báo cáo gửi thông báo nhắc nhở thanh toán - ${new Date().toLocaleDateString('vi-VN')}`;
    
    const errorDetails = results.details
      .filter(item => item.status === 'error')
      .map(item => `
        <li>
          <strong>Bill ID:</strong> ${item.billId}<br>
          <strong>Lỗi:</strong> ${item.error}
        </li>
      `).join('');
    
    const sentDetails = results.details
      .filter(item => item.status === 'sent')
      .map(item => `
        <li>
          <strong>Phòng:</strong> ${item.roomNumber} - 
          <strong>Tenant:</strong> ${item.tenantName} - 
          <strong>Còn:</strong> ${item.daysUntilDue} ngày
        </li>
      `).join('');
    
    const body = `
      <h2>Báo cáo gửi thông báo nhắc nhở thanh toán</h2>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      
      <h3>Tổng kết:</h3>
      <ul>
        <li>Tổng số hóa đơn: ${results.total}</li>
        <li>Đã gửi thông báo: ${results.sent}</li>
        <li>Bỏ qua: ${results.skipped}</li>
        <li>Lỗi: ${results.errors}</li>
      </ul>
      
      ${results.sent > 0 ? `
        <h3>Danh sách đã gửi thông báo:</h3>
        <ul>${sentDetails}</ul>
      ` : ''}
      
      ${results.errors > 0 ? `
        <h3>Danh sách lỗi:</h3>
        <ul>${errorDetails}</ul>
      ` : ''}
      
      <p><em>Email tự động từ hệ thống quản lý phòng trọ</em></p>
    `;
    
    await sendEmailNotification({
      to: adminEmail,
      subject,
      html: body,
    });
    
    console.log('✅ Đã gửi email báo cáo cho admin');
  } catch (error) {
    console.error('❌ Lỗi khi gửi email báo cáo:', error.message);
  }
}

/**
 * Gửi cảnh báo nghiêm trọng cho admin
 */
async function sendCriticalErrorNotification(error) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    
    const subject = `[CẢNH BÁO] Lỗi nghiêm trọng khi gửi thông báo nhắc nhở thanh toán`;
    
    const body = `
      <h2 style="color: red;">⚠️ Lỗi nghiêm trọng</h2>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      <p><strong>Lỗi:</strong> ${error.message}</p>
      <pre>${error.stack}</pre>
      <p><em>Vui lòng kiểm tra hệ thống ngay!</em></p>
    `;
    
    await sendEmailNotification({
      to: adminEmail,
      subject,
      html: body,
    });
  } catch (emailError) {
    // Silent fail
  }
}

/**
 * Chạy job thủ công (dùng cho testing)
 */
export async function runRentReminderJobManually(daysBeforeDue = 3) {
  console.log('🔧 Chạy job nhắc nhở thanh toán thủ công...');
  
  try {
    const results = await scanAndSendRentReminders(daysBeforeDue);
    console.log('✅ Hoàn tất:', results);
    return results;
  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  }
}

export default {
  scheduleRentReminderJob,
  runRentReminderJobManually,
};
