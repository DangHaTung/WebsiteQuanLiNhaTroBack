// Job tự động kiểm tra và hủy phiếu thu quá hạn
import cron from 'node-cron';
import { checkAndCancelExpiredReceipts, sendExpirationWarningEmails } from '../services/checkin/receiptExpiration.service.js';

/**
 * Cron job tự động kiểm tra và hủy phiếu thu quá hạn
 * Chạy hàng ngày vào 00:00
 */
export function scheduleReceiptExpirationJob() {
  // Cron expression: '0 0 * * *' = 00:00 hàng ngày
  const cronExpression = process.env.RECEIPT_EXPIRATION_CRON || '0 0 * * *';
  
  console.log(`📅 Đã thiết lập cron job kiểm tra phiếu thu quá hạn: ${cronExpression}`);
  
  const job = cron.schedule(cronExpression, async () => {
    console.log('\n=== BẮT ĐẦU KIỂM TRA VÀ HỦY PHIẾU THU QUÁ HẠN ===');
    console.log('⏰ Thời gian:', new Date().toISOString());
    
    try {
      // Kiểm tra và hủy các phiếu thu quá hạn
      const results = await checkAndCancelExpiredReceipts();
      
      console.log('✅ Kết quả:');
      console.log(`   - Tổng số checkin đã thanh toán: ${results.total}`);
      console.log(`   - Số phiếu thu quá hạn: ${results.expired}`);
      console.log(`   - Số phiếu thu đã hủy: ${results.canceled}`);
      console.log(`   - Lỗi: ${results.errors}`);
      
      // Log chi tiết các lỗi
      if (results.errors > 0) {
        console.log('\n❌ Danh sách lỗi:');
        results.details
          .filter(item => item.status === 'error')
          .forEach((item, index) => {
            console.log(`   ${index + 1}. Checkin ${item.checkinId}: ${item.error}`);
          });
      }
      
      console.log('=== KẾT THÚC KIỂM TRA VÀ HỦY PHIẾU THU QUÁ HẠN ===\n');
      
    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG khi kiểm tra phiếu thu quá hạn:', error);
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'
  });
  
  return job;
}

/**
 * Cron job tự động gửi email cảnh báo trước khi hết hạn
 * Chạy hàng ngày vào 9:00 sáng
 */
export function scheduleReceiptExpirationWarningJob() {
  // Cron expression: '0 9 * * *' = 09:00 hàng ngày
  const cronExpression = process.env.RECEIPT_EXPIRATION_WARNING_CRON || '0 9 * * *';
  
  console.log(`📅 Đã thiết lập cron job gửi email cảnh báo hết hạn phiếu thu: ${cronExpression}`);
  
  const job = cron.schedule(cronExpression, async () => {
    console.log('\n=== BẮT ĐẦU GỬI EMAIL CẢNH BÁO HẾT HẠN PHIẾU THU ===');
    console.log('⏰ Thời gian:', new Date().toISOString());
    
    try {
      // Gửi email cảnh báo
      const results = await sendExpirationWarningEmails();
      
      console.log('✅ Kết quả:');
      console.log(`   - Tổng số checkin: ${results.total}`);
      console.log(`   - Đã gửi email: ${results.sent}`);
      console.log(`   - Bỏ qua: ${results.skipped}`);
      console.log(`   - Lỗi: ${results.errors}`);
      
      // Log chi tiết các lỗi
      if (results.errors > 0) {
        console.log('\n❌ Danh sách lỗi:');
        results.details
          .filter(item => item.status === 'error')
          .forEach((item, index) => {
            console.log(`   ${index + 1}. Checkin ${item.checkinId}: ${item.error}`);
          });
      }
      
      console.log('=== KẾT THÚC GỬI EMAIL CẢNH BÁO HẾT HẠN PHIẾU THU ===\n');
      
    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG khi gửi email cảnh báo hết hạn:', error);
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'
  });
  
  return job;
}

