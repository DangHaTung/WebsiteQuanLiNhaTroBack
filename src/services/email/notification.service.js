// Service gửi email notification
import nodemailer from 'nodemailer';

/**
 * Tạo transporter cho nodemailer
 */
function createTransporter() {
  // Kiểm tra cấu hình email
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn('⚠️  Email chưa được cấu hình. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS trong .env');
    return null;
  }
  
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Gửi email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Email người nhận
 * @param {string} options.subject - Tiêu đề email
 * @param {string} options.html - Nội dung HTML
 * @param {string} options.text - Nội dung text (optional)
 */
export async function sendEmailNotification({ to, subject, html, text }) {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('⚠️  Email transporter không khả dụng, bỏ qua gửi email');
    return { success: false, message: 'Email not configured' };
  }
  
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Hệ thống Quản lý Phòng trọ'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || 'Email notification',
      html,
    });
    
    console.log('✅ Email đã gửi:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gửi email thông báo hóa đơn mới cho tenant
 */
export async function sendBillNotificationToTenant({ tenant, bill, room }) {
  if (!tenant.email) {
    console.log('⚠️  Tenant không có email, bỏ qua gửi thông báo');
    return;
  }
  
  const subject = `Hóa đơn tháng ${new Date(bill.billingDate).getMonth() + 1}/${new Date(bill.billingDate).getFullYear()} - Phòng ${room.roomNumber}`;
  
  const html = `
    <h2>Thông báo hóa đơn mới</h2>
    <p>Xin chào <strong>${tenant.fullName}</strong>,</p>
    <p>Hóa đơn tháng ${new Date(bill.billingDate).getMonth() + 1}/${new Date(bill.billingDate).getFullYear()} của bạn đã được tạo.</p>
    
    <h3>Thông tin hóa đơn:</h3>
    <ul>
      <li><strong>Phòng:</strong> ${room.roomNumber}</li>
      <li><strong>Ngày lập:</strong> ${new Date(bill.billingDate).toLocaleDateString('vi-VN')}</li>
      <li><strong>Tổng tiền:</strong> ${bill.amountDue.toLocaleString('vi-VN')} VNĐ</li>
      <li><strong>Trạng thái:</strong> ${bill.status === 'UNPAID' ? 'Chưa thanh toán' : bill.status}</li>
    </ul>
    
    <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và thanh toán.</p>
    <p><em>Trân trọng,<br>Ban quản lý</em></p>
  `;
  
  return await sendEmailNotification({
    to: tenant.email,
    subject,
    html,
  });
}

export default {
  sendEmailNotification,
  sendBillNotificationToTenant,
};
