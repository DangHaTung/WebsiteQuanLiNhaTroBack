/**
 * Script test cấu hình email
 * Chạy: node scripts/test-email.js
 */
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('🧪 Testing email configuration...\n');
  
  // Kiểm tra env vars
  const requiredVars = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.log('\n📝 Please set in .env file:');
    missing.forEach(v => console.log(`   ${v}=your_value`));
    process.exit(1);
  }
  
  console.log('✅ Environment variables found:');
  console.log(`   EMAIL_HOST: ${process.env.EMAIL_HOST} (SMTP Outgoing Server)`);
  console.log(`   EMAIL_PORT: ${process.env.EMAIL_PORT || '587'}`);
  console.log(`   EMAIL_SECURE: ${process.env.EMAIL_SECURE || 'false'}`);
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);
  console.log('');
  console.log('💡 Lưu ý: EMAIL_HOST phải là SMTP Outgoing Server (không phải IMAP Incoming)');
  console.log('   Ví dụ: Nếu Outlook cấu hình SMTP out = mail.hostvn.email');
  console.log('   → EMAIL_HOST=mail.hostvn.email\n');
  
  // Tạo transporter
  const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Thêm debug để xem chi tiết
    debug: true,
    logger: true,
  });
  
  // Test connection
  console.log('🔌 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:');
    console.error('   Error:', error.message);
    console.error('\n💡 Common issues:');
    console.error('   1. Wrong EMAIL_HOST (try mail.tro360.com or smtp.tro360.com)');
    console.error('   2. Wrong port (try 587 for TLS or 465 for SSL)');
    console.error('   3. Wrong credentials');
    console.error('   4. Firewall blocking port');
    console.error('   5. Need to set EMAIL_SECURE=true for port 465');
    process.exit(1);
  }
  
  // Test send email
  const testEmail = process.env.TEST_EMAIL_TO || process.env.EMAIL_USER;
  console.log(`📧 Sending test email to: ${testEmail}...`);
  
  try {
    const info = await transporter.sendMail({
      from: `"Test Email" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: '🧪 Test Email từ Hệ thống Quản lý Phòng trọ',
      html: `
        <h2>Test Email thành công!</h2>
        <p>Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động đúng.</p>
        <p><strong>Thông tin cấu hình:</strong></p>
        <ul>
          <li>Host: ${process.env.EMAIL_HOST}</li>
          <li>Port: ${process.env.EMAIL_PORT || '587'}</li>
          <li>User: ${process.env.EMAIL_USER}</li>
        </ul>
        <p>Trân trọng,<br>Hệ thống</p>
      `,
      text: 'Test Email thành công! Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động đúng.',
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log('\n🎉 Email configuration is working correctly!');
  } catch (error) {
    console.error('❌ Failed to send test email:');
    console.error('   Error:', error.message);
    console.error('\n💡 Check:');
    console.error('   1. Email address is valid');
    console.error('   2. SMTP server allows sending from this account');
    console.error('   3. Check spam folder');
    process.exit(1);
  }
}

testEmail().catch(console.error);

