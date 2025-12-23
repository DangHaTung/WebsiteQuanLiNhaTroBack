// Job tự động gửi thông báo trước khi tạo hóa đơn hàng tháng
import cron from 'node-cron';
import moment from 'moment';
import { scanAndSendUpcomingBillNotifications } from '../services/notification/upcomingBill.service.js';
import { sendEmailNotification } from '../services/email/notification.service.js';

/**
 * Cron job gửi thông báo trước khi tạo hóa đơn
 * Chạy vào ngày 29 và ngày 3 hàng tháng
 */
export function scheduleUpcomingBillJob() {
  // Lấy ngày tạo hóa đơn từ env (mặc định là ngày 5)
  const billingDay = parseInt(process.env.MONTHLY_BILLING_DAY || '5');
  
  // Cron cho ngày 29: Thông báo trước 6-7 ngày (tùy tháng 30 hay 31 ngày)
  const cron29 = '0 9 29 * *'; // 09:00 ngày 29 hàng tháng
  
  // Cron cho ngày 3: Thông báo trước 2 ngày
  const cron3 = '0 9 3 * *'; // 09:00 ngày 3 hàng tháng
  
  // Job chạy ngày 29
  const job29 = cron.schedule(cron29, async () => {
    console.log('\n=== THÔNG BÁO HÓA ĐƠN SẮP TỚI (NGÀY 29) ===');
    console.log('⏰ Thời gian:', new Date().toISOString());
    
    try {
      // Tính ngày tạo hóa đơn (ngày 5 tháng sau)
      const nextMonth = moment().add(1, 'month');
      const billingDate = moment(nextMonth).date(billingDay).startOf('day').toDate();
      
      // Tính số ngày còn lại
      const today = moment().startOf('day');
      const daysUntil = moment(billingDate).diff(today, 'days');
      

      
      // Gửi thông báo
      const results = await scanAndSendUpcomingBillNotifications(daysUntil, billingDate);
      
      console.log('✅ Kết quả:');
      console.log(`   - Tổng số hợp đồng: ${results.total}`);
      console.log(`   - Đã gửi: ${results.sent}`);
      console.log(`   - Bỏ qua: ${results.skipped}`);
      console.log(`   - Lỗi: ${results.errors}`);
      
      // Gửi email báo cáo cho admin nếu có lỗi
      if (results.errors > 0) {
        await sendAdminReport(results, 'Ngày 29', daysUntil, billingDate);
      }
      
      console.log('=== KẾT THÚC THÔNG BÁO (NGÀY 29) ===\n');
      
    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG:', error);
      await sendCriticalErrorNotification(error, 'Ngày 29');
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'
  });
  
  // Job chạy ngày 3
  const job3 = cron.schedule(cron3, async () => {
    console.log('\n=== THÔNG BÁO HÓA ĐƠN SẮP TỚI (NGÀY 3) ===');
    console.log('⏰ Thời gian:', new Date().toISOString());
    
    try {
      // Tính ngày tạo hóa đơn (ngày 5 tháng này)
      const billingDate = moment().date(billingDay).startOf('day').toDate();
      
      // Tính số ngày còn lại
      const today = moment().startOf('day');
      const daysUntil = moment(billingDate).diff(today, 'days');
      
      // Gửi thông báo
      const results = await scanAndSendUpcomingBillNotifications(daysUntil, billingDate);
      
      console.log('✅ Kết quả:');
      console.log(`   - Tổng số hợp đồng: ${results.total}`);
      console.log(`   - Đã gửi: ${results.sent}`);
      console.log(`   - Bỏ qua: ${results.skipped}`);
      console.log(`   - Lỗi: ${results.errors}`);
      
      // Gửi email báo cáo cho admin nếu có lỗi
      if (results.errors > 0) {
        await sendAdminReport(results, 'Ngày 3', daysUntil, billingDate);
      }
      
      console.log('=== KẾT THÚC THÔNG BÁO (NGÀY 3) ===\n');
      
    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG:', error);
      await sendCriticalErrorNotification(error, 'Ngày 3');
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'
  });
  
  return { job29, job3 };
}

/**
 * Gửi báo cáo cho admin
 */
async function sendAdminReport(results, dayLabel, daysUntil, billingDate) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('⚠️  Không có ADMIN_EMAIL trong env, bỏ qua gửi email');
      return;
    }
    
    const subject = `[Hệ thống] Báo cáo thông báo hóa đơn sắp tới (${dayLabel}) - ${new Date().toLocaleDateString('vi-VN')}`;
    
    const errorDetails = results.details
      .filter(item => item.status === 'error')
      .map(item => `
        <li>
          <strong>Contract ID:</strong> ${item.contractId}<br>
          <strong>Phòng:</strong> ${item.roomNumber || 'N/A'}<br>
          <strong>Lỗi:</strong> ${item.error}
        </li>
      `).join('');
    
    const sentDetails = results.details
      .filter(item => item.status === 'sent')
      .map(item => `
        <li>
          <strong>Phòng:</strong> ${item.roomNumber} - 
          <strong>Tenant:</strong> ${item.tenantName}
        </li>
      `).join('');
    
    const body = `
      <h2>Báo cáo thông báo hóa đơn sắp tới (${dayLabel})</h2>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      <p><strong>Ngày tạo hóa đơn:</strong> ${moment(billingDate).format('DD/MM/YYYY')}</p>
      <p><strong>Còn:</strong> ${daysUntil} ngày</p>
      
      <h3>Tổng kết:</h3>
      <ul>
        <li>Tổng số hợp đồng: ${results.total}</li>
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
      
      <p><em>Email tự động từ Ban Quản lý Phòng Tro360</em></p>
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
async function sendCriticalErrorNotification(error, dayLabel) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    
    const subject = `[CẢNH BÁO] Lỗi nghiêm trọng khi gửi thông báo hóa đơn sắp tới (${dayLabel})`;
    
    const body = `
      <h2 style="color: red;">⚠️ Lỗi nghiêm trọng</h2>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      <p><strong>Job:</strong> Thông báo hóa đơn sắp tới (${dayLabel})</p>
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
export async function runUpcomingBillJobManually(daysBeforeBilling = 2) {
  console.log('🔧 Chạy job thông báo hóa đơn sắp tới thủ công...');
  
  try {
    const billingDay = parseInt(process.env.MONTHLY_BILLING_DAY || '5');
    const billingDate = moment().date(billingDay).startOf('day').toDate();
    
    const results = await scanAndSendUpcomingBillNotifications(daysBeforeBilling, billingDate);
    console.log('✅ Hoàn tất:', results);
    return results;
  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  }
}

export default {
  scheduleUpcomingBillJob,
  runUpcomingBillJobManually,
};
