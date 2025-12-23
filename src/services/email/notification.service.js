// Service gửi email notification
import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';

/**
 * Thông tin tài khoản ngân hàng (giống client)
 */
const bankInfo = {
  accountNumber: process.env.BANK_ACCOUNT_NUMBER || "1903 7801 6150 17",
  accountName: process.env.BANK_ACCOUNT_NAME || "HOANG VAN QUYNH",
  bankName: process.env.BANK_NAME || "TECHCOMBANK",
  bankBin: process.env.BANK_BIN || "970407"
};

/**
 * Format description cho VietQR (loại bỏ dấu, ký tự đặc biệt)
 */
function formatDescriptionForQR(description) {
  return description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tạo VietQR URL
 */
function generateVietQRUrl(amount, description) {
  const formattedDesc = formatDescriptionForQR(description);
  const accountNo = bankInfo.accountNumber.replace(/\s/g, "");
  return `https://img.vietqr.io/image/${bankInfo.bankBin}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(formattedDesc)}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
}

/**
 * Tạo transporter cho nodemailer
 */
function createTransporter() {
  // Kiểm tra cấu hình email
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn('⚠️  Email chưa được cấu hình. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS trong .env');
    return null;
  }
  
  return createTransport({
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
      from: `"${process.env.EMAIL_FROM_NAME || 'Ban Quản lý Phòng Tro360'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || 'Email notification',
      html,
      // ✅ FIX: Thêm envelope để tránh DMARC fail
      envelope: {
        from: process.env.EMAIL_USER,
        to,
      },
      // ✅ FIX: Thêm headers để Gmail hiểu đây là mail hệ thống
      headers: {
        'X-Mailer': 'Tro360 System Mailer',
        'X-Priority': '3',
        'Auto-Submitted': 'auto-generated',
      },
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

/**
 * Gửi email link thanh toán cho khách hàng
 */
export async function sendPaymentLinkEmail({ to, fullName, paymentUrl, billId, amount, roomNumber, expiresAt, paymentToken }) {
  // ✅ FIX: Cải thiện subject để tránh spam words
  const subject = `Thông báo khoản cần xác nhận – Phòng ${roomNumber}`;
  
  const expiresDate = new Date(expiresAt).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Tạo VietQR URL
  const description = `Thanh toan tien coc phong ${roomNumber} ${billId.slice(-6)}`;
  const qrCodeUrl = generateVietQRUrl(amount, description);
  const accountNo = bankInfo.accountNumber.replace(/\s/g, "");

  // Tạo link để upload ảnh bill sau khi chuyển khoản
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const uploadReceiptUrl = paymentToken 
    ? `${frontendUrl}/public/payment/${billId}/${paymentToken}/upload-receipt`
    : null;

  // ✅ FIX: Thêm text version đầy đủ
  const text = `
Xin chào ${fullName},

Bạn có một khoản thanh toán cho phòng ${roomNumber}.

Thông tin thanh toán:
- Mã phiếu thu: ${billId.substring(0, 8)}...
- Phòng: ${roomNumber}
- Số tiền: ${(amount || 0).toLocaleString('vi-VN')} VNĐ
- Link có hiệu lực đến: ${expiresDate}

Link thanh toán: ${paymentUrl}

Thông tin chuyển khoản ngân hàng:
- Ngân hàng: ${bankInfo.bankName}
- Số tài khoản: ${accountNo}
- Chủ tài khoản: ${bankInfo.accountName}
- Nội dung: ${description}

Bạn có thể quét mã QR trong email để chuyển khoản nhanh chóng.

${uploadReceiptUrl ? `\nSau khi chuyển khoản, vui lòng truy cập link sau để upload ảnh bill:\n${uploadReceiptUrl}\n` : ''}

Lưu ý: Link thanh toán này chỉ có hiệu lực trong 5 ngày. Vui lòng thanh toán trước khi hết hạn.

Nếu có thắc mắc, vui lòng liên hệ ${process.env.EMAIL_USER}.

Trân trọng,
Ban quản lý
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1890ff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1890ff; }
        .amount { font-size: 24px; font-weight: bold; color: #1890ff; }
        .button { display: inline-block; padding: 12px 24px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin-top: 15px; border-radius: 5px; }
        .qr-section { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; border: 2px solid #1890ff; }
        .qr-code { max-width: 250px; height: auto; margin: 15px 0; border-radius: 8px; }
        .bank-info { background-color: #f0f7ff; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #1890ff; }
        .bank-info-item { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>💳 Thông báo khoản cần xác nhận</h2>
        </div>
        <div class="content">
          <p>Xin chào <strong>${fullName}</strong>,</p>
          
          <p>Bạn có một khoản thanh toán cho phòng <strong>${roomNumber}</strong>.</p>
          
          <div class="info-box">
            <h3>Thông tin thanh toán:</h3>
            <ul>
              <li><strong>Mã phiếu thu:</strong> ${billId.substring(0, 8)}...</li>
              <li><strong>Phòng:</strong> ${roomNumber}</li>
              <li><strong>Số tiền:</strong> <span class="amount">${(amount || 0).toLocaleString('vi-VN')} VNĐ</span></li>
              <li><strong>Link có hiệu lực đến:</strong> ${expiresDate}</li>
            </ul>
          </div>

          <!-- VietQR Section -->
          <div class="qr-section">
            <h3 style="margin-top: 0; color: #1890ff;">📱 Quét mã QR để chuyển khoản</h3>
            <img src="${qrCodeUrl}" alt="VietQR Code" class="qr-code" />
            <div class="bank-info">
              <div class="bank-info-item"><strong>Ngân hàng:</strong> ${bankInfo.bankName}</div>
              <div class="bank-info-item"><strong>Số tài khoản:</strong> ${accountNo}</div>
              <div class="bank-info-item"><strong>Chủ tài khoản:</strong> ${bankInfo.accountName}</div>
              <div class="bank-info-item"><strong>Nội dung:</strong> ${description}</div>
            </div>
          </div>

          ${uploadReceiptUrl ? `
          <!-- Upload Receipt Section -->
          <div style="background-color: #f0f9ff; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #1890ff; text-align: center;">
            <h3 style="margin-top: 0; color: #1890ff;">📸 Đã chuyển khoản?</h3>
            <p style="margin: 10px 0;">Sau khi chuyển khoản, vui lòng upload ảnh bill để admin xác nhận:</p>
            <a href="${uploadReceiptUrl}" class="button" style="background-color: #52c41a; border-color: #52c41a; margin-top: 10px;">
              📤 Xác nhận đã chuyển khoản
            </a>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentUrl}" class="button">🔗 Thanh toán trực tuyến</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Lưu ý:</strong> Link thanh toán này chỉ có hiệu lực trong 5 ngày. Vui lòng thanh toán trước khi hết hạn.
          </div>
          
          <p style="margin-top: 20px;">Nếu bạn không thể click vào nút trên, vui lòng copy link sau vào trình duyệt:</p>
          <p style="word-break: break-all; color: #1890ff;">${paymentUrl}</p>
          
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
  
  return await sendEmailNotification({
    to,
    subject,
    html,
    text,
  });
}

/**
 * Gửi email thông báo tài khoản đã được tạo sau khi thanh toán thành công
 */
export async function sendAccountCreatedEmail({ to, fullName, email, password, loginUrl }) {
  const subject = `Tài khoản đã được tạo - Ban Quản lý Phòng Tro360`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #52c41a; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #52c41a; }
        .credentials { background-color: #f0f9ff; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #52c41a; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin-top: 15px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Tài khoản đã được tạo thành công</h2>
        </div>
        <div class="content">
          <p>Xin chào <strong>${fullName}</strong>,</p>
          
          <p>Chúc mừng! Thanh toán của bạn đã được xác nhận thành công. Tài khoản đã được tự động tạo để bạn có thể đăng nhập và quản lý thông tin.</p>
          
          <div class="info-box">
            <h3>🔐 Thông tin đăng nhập:</h3>
            <div class="credentials">
              <p><strong>Email đăng nhập:</strong> ${email}</p>
              <p><strong>Mật khẩu:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 3px; font-size: 16px;">${password}</code></p>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" class="button">🚪 Đăng nhập ngay</a>
          </div>
          
          <div class="warning">
            <strong>🔒 Bảo mật:</strong> Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu để bảo vệ tài khoản của bạn.
          </div>
          
          <p style="margin-top: 20px;">Nếu bạn không thể click vào nút trên, vui lòng truy cập:</p>
          <p style="word-break: break-all; color: #52c41a;">${loginUrl}</p>
          
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
  
  return await sendEmailNotification({
    to,
    subject,
    html,
  });
}

/**
 * Gửi email thông báo thanh toán thành công
 */
export async function sendPaymentSuccessEmail({ to, fullName, bill, amount, transactionId, provider }) {
  const subject = `Thanh toán thành công`;
  
  const billTypeText = bill.billType === 'RECEIPT' ? 'Tiền đặt cọc' :
                       bill.billType === 'CONTRACT' ? 'Tiền thuê tháng đầu' : 
                       bill.billType === 'MONTHLY' ? 'Hóa đơn hàng tháng' : 
                       'Phiếu thu';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #52c41a; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #52c41a; }
        .amount { font-size: 24px; font-weight: bold; color: #52c41a; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Thanh toán thành công</h2>
        </div>
        <div class="content">
          <p>Xin chào <strong>${fullName}</strong>,</p>
          
          <p>Thanh toán của bạn đã được xác nhận thành công!</p>
          
          <div class="info-box">
            <h3>Thông tin thanh toán:</h3>
            <ul>
              <li><strong>Loại hóa đơn:</strong> ${billTypeText}</li>
              <li><strong>Mã hóa đơn:</strong> ${bill._id.toString().substring(0, 8)}...</li>
              <li><strong>Số tiền:</strong> <span class="amount">${(amount || 0).toLocaleString('vi-VN')} VNĐ</span></li>
              <li><strong>Phương thức:</strong> ${provider.toUpperCase()}</li>
              <li><strong>Mã giao dịch:</strong> ${transactionId}</li>
              <li><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</li>
            </ul>
          </div>
          
          <p>Cảm ơn bạn đã thanh toán đúng hạn!</p>
          
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
  
  return await sendEmailNotification({
    to,
    subject,
    html,
  });
}

export default {
  sendEmailNotification,
  sendBillNotificationToTenant,
  sendPaymentLinkEmail,
  sendAccountCreatedEmail,
  sendPaymentSuccessEmail,
};
