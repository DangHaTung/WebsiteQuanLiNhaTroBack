// Job tự động tạo hóa đơn hàng tháng
import cron from 'node-cron';
import { createMonthlyBillsForAllRooms } from '../services/billing/monthlyBill.service.js';
import { sendEmailNotification } from '../services/email/notification.service.js';
import { sendNewBillNotification } from '../services/notification/rentReminder.service.js';

/**
 * Cron job tự động tạo hóa đơn hàng tháng
 * Chạy vào 00:00 ngày 1 hàng tháng
 */
export function scheduleMonthlyBillingJob() {
  // Cron expression: '0 0 1 * *' = 00:00 ngày 1 hàng tháng
  const cronExpression = process.env.MONTHLY_BILLING_CRON || '0 0 5 * *';
  
  console.log(`📅 Đã thiết lập cron job tạo hóa đơn hàng tháng: ${cronExpression}`);
  
  const job = cron.schedule(cronExpression, async () => {
    console.log('\n=== BẮT ĐẦU TẠO HÓA ĐƠN HÀNG THÁNG TỰ ĐỘNG ===');
    console.log('⏰ Thời gian:', new Date().toISOString());
    
    try {
      // Tạo hóa đơn cho tất cả phòng
      const results = await createMonthlyBillsForAllRooms({
        billingDate: new Date(),
        roomUsageData: {}, // Dùng giá trị mặc định
      });
      
      console.log('✅ Kết quả:');
      console.log(`   - Tổng số hợp đồng: ${results.summary.total}`);
      console.log(`   - Đã tạo: ${results.summary.created} hóa đơn`);
      console.log(`   - Bỏ qua: ${results.summary.skipped} hóa đơn`);
      console.log(`   - Lỗi: ${results.summary.errors} hóa đơn`);
      
      // Gửi thông báo real-time cho các hóa đơn mới được tạo
      console.log('\n📤 Gửi thông báo real-time cho hóa đơn mới...');
      for (const billInfo of results.success) {
        try {
          if (billInfo.tenant) {
            await sendNewBillNotification(
              { _id: billInfo.billId, billingDate: new Date(), amountDue: billInfo.totalAmount, status: 'UNPAID' },
              billInfo.tenant,
              { roomNumber: billInfo.roomNumber }
            );
          }
        } catch (notifError) {
          console.error(`❌ Lỗi gửi thông báo cho bill ${billInfo.billId}:`, notifError.message);
        }
      }
      console.log('✅ Hoàn tất gửi thông báo real-time');
      
      // Gửi email thông báo cho admin (nếu có lỗi)
      if (results.summary.errors > 0 || results.summary.skipped > 0) {
        console.log('⚠️  Có lỗi hoặc hóa đơn bị bỏ qua, gửi email thông báo...');
        await sendAdminNotification(results);
      }
      
      // Log chi tiết các lỗi
      if (results.failed.length > 0) {
        console.log('\n❌ Danh sách lỗi:');
        results.failed.forEach((item, index) => {
          console.log(`   ${index + 1}. Phòng ${item.roomNumber || 'N/A'}: ${item.error}`);
        });
      }
      
      console.log('=== KẾT THÚC TẠO HÓA ĐƠN HÀNG THÁNG ===\n');
      
    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG khi tạo hóa đơn hàng tháng:', error);
      
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
 * Gửi thông báo cho admin về kết quả tạo hóa đơn
 */
async function sendAdminNotification(results) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('⚠️  Không có ADMIN_EMAIL trong env, bỏ qua gửi email');
      return;
    }
    
    const subject = `[Hệ thống] Báo cáo tạo hóa đơn hàng tháng - ${new Date().toLocaleDateString('vi-VN')}`;
    
    const body = `
      <h2>Báo cáo tạo hóa đơn hàng tháng</h2>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      
      <h3>Tổng kết:</h3>
      <ul>
        <li>Tổng số hợp đồng: ${results.summary.total}</li>
        <li>Đã tạo thành công: ${results.summary.created}</li>
        <li>Bỏ qua: ${results.summary.skipped}</li>
        <li>Lỗi: ${results.summary.errors}</li>
      </ul>
      
      ${results.failed.length > 0 ? `
        <h3>Danh sách lỗi:</h3>
        <ul>
          ${results.failed.map(item => `
            <li>
              <strong>Phòng ${item.roomNumber || 'N/A'}</strong>: ${item.error}
              ${item.contractId ? `<br><small>Contract ID: ${item.contractId}</small>` : ''}
            </li>
          `).join('')}
        </ul>
      ` : ''}
      
      <p><em>Email tự động từ hệ thống quản lý phòng trọ</em></p>
    `;
    
    await sendEmailNotification({
      to: adminEmail,
      subject,
      html: body,
    });
    
    console.log('✅ Đã gửi email thông báo cho admin');
  } catch (error) {
    console.error('❌ Lỗi khi gửi email thông báo:', error.message);
  }
}

/**
 * Gửi cảnh báo nghiêm trọng cho admin
 */
async function sendCriticalErrorNotification(error) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    
    const subject = `[CẢNH BÁO] Lỗi nghiêm trọng khi tạo hóa đơn hàng tháng`;
    
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
export async function runMonthlyBillingJobManually() {
  console.log('🔧 Chạy job tạo hóa đơn thủ công...');
  
  try {
    const results = await createMonthlyBillsForAllRooms({
      billingDate: new Date(),
      roomUsageData: {},
    });
    
    console.log('✅ Hoàn tất:', results.summary);
    return results;
  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  }
}

export default {
  scheduleMonthlyBillingJob,
  runMonthlyBillingJobManually,
};
