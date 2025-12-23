// Service xử lý hết hạn phiếu thu (receipt expiration)
import Checkin from '../../models/checkin.model.js';
import Bill from '../../models/bill.model.js';
import Contract from '../../models/contract.model.js';
import { sendEmailNotification } from '../email/notification.service.js';

/**
 * Kiểm tra và tự động hủy các phiếu thu quá hạn
 * Hủy nếu: đã thanh toán > 3 ngày và chưa thanh toán hóa đơn CONTRACT
 */
export async function checkAndCancelExpiredReceipts() {
  const results = {
    total: 0,
    expired: 0,
    canceled: 0,
    errors: 0,
    details: [],
  };

  try {
    // Tìm tất cả checkin đã thanh toán phiếu thu (receiptPaidAt có giá trị)
    // và status là COMPLETED (chưa bị hủy)
    const checkins = await Checkin.find({
      receiptPaidAt: { $exists: true, $ne: null },
      status: 'COMPLETED',
    })
      .populate('receiptBillId')
      .populate('contractId')
      .populate('tenantId', 'fullName email phone')
      .populate('roomId', 'roomNumber');

    results.total = checkins.length;

    const now = new Date();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 ngày tính bằng milliseconds

    for (const checkin of checkins) {
      try {
        const receiptPaidAt = new Date(checkin.receiptPaidAt);
        const daysSincePaid = (now - receiptPaidAt) / (24 * 60 * 60 * 1000);

        // Kiểm tra nếu đã quá 3 ngày
        if (daysSincePaid > 3) {
          results.expired++;

          // Kiểm tra xem đã thanh toán hóa đơn CONTRACT chưa
          const contract = checkin.contractId;
          if (contract) {
            const contractBills = await Bill.find({
              contractId: contract._id,
              billType: 'CONTRACT',
              status: 'PAID',
            });

            // Nếu chưa thanh toán hóa đơn CONTRACT, hủy phiếu thu
            if (contractBills.length === 0) {
              // Hủy checkin
              checkin.status = 'CANCELED';
              checkin.depositDisposition = 'FORFEIT';
              await checkin.save();

              results.canceled++;
              results.details.push({
                checkinId: checkin._id,
                status: 'canceled',
                message: `Đã tự động hủy phiếu thu vì quá hạn 3 ngày (đã thanh toán ${Math.floor(daysSincePaid)} ngày trước)`,
              });

              console.log(`✅ Đã tự động hủy checkin ${checkin._id} - quá hạn ${Math.floor(daysSincePaid)} ngày`);

              // Gửi email thông báo hủy
              if (checkin.tenantId && checkin.tenantId.email) {
                try {
                  await sendExpirationCancelEmail(checkin);
                } catch (emailErr) {
                  console.error(`❌ Lỗi khi gửi email hủy cho checkin ${checkin._id}:`, emailErr);
                }
              }
            } else {
              results.details.push({
                checkinId: checkin._id,
                status: 'skipped',
                message: `Đã quá hạn nhưng đã thanh toán hóa đơn CONTRACT nên không hủy`,
              });
            }
          } else {
            // Không có contract, vẫn hủy
            checkin.status = 'CANCELED';
            checkin.depositDisposition = 'FORFEIT';
            await checkin.save();

            results.canceled++;
            results.details.push({
              checkinId: checkin._id,
              status: 'canceled',
              message: `Đã tự động hủy phiếu thu vì quá hạn 3 ngày (không có contract)`,
            });
          }
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          checkinId: checkin._id,
          status: 'error',
          error: error.message,
        });
        console.error(`❌ Lỗi khi xử lý checkin ${checkin._id}:`, error);
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng khi kiểm tra phiếu thu quá hạn:', error);
    throw error;
  }
}

/**
 * Gửi email thông báo trước khi hết hạn (1 ngày trước)
 */
export async function sendExpirationWarningEmails() {
  const results = {
    total: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  try {
    // Tìm tất cả checkin đã thanh toán phiếu thu và chưa bị hủy
    const checkins = await Checkin.find({
      receiptPaidAt: { $exists: true, $ne: null },
      status: 'COMPLETED',
    })
      .populate('receiptBillId')
      .populate('contractId')
      .populate('tenantId', 'fullName email phone')
      .populate('roomId', 'roomNumber');

    results.total = checkins.length;

    const now = new Date();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

    for (const checkin of checkins) {
      try {
        const receiptPaidAt = new Date(checkin.receiptPaidAt);
        const daysSincePaid = (now - receiptPaidAt) / (24 * 60 * 60 * 1000);
        const daysRemaining = 3 - daysSincePaid;

        // Gửi email cảnh báo nếu còn 1 ngày hoặc ít hơn
        if (daysRemaining <= 1 && daysRemaining > 0) {
          // Kiểm tra xem đã thanh toán hóa đơn CONTRACT chưa
          const contract = checkin.contractId;
          if (contract) {
            const contractBills = await Bill.find({
              contractId: contract._id,
              billType: 'CONTRACT',
              status: 'PAID',
            });

            // Chỉ gửi email nếu chưa thanh toán hóa đơn CONTRACT
            if (contractBills.length === 0) {
              if (checkin.tenantId && checkin.tenantId.email) {
                try {
                  await sendExpirationWarningEmail(checkin, daysRemaining);
                  results.sent++;
                  results.details.push({
                    checkinId: checkin._id,
                    status: 'sent',
                    message: `Đã gửi email cảnh báo hết hạn (còn ${Math.ceil(daysRemaining * 24)} giờ)`,
                  });
                } catch (emailErr) {
                  results.errors++;
                  results.details.push({
                    checkinId: checkin._id,
                    status: 'error',
                    error: emailErr.message,
                  });
                }
              } else {
                results.skipped++;
                results.details.push({
                  checkinId: checkin._id,
                  status: 'skipped',
                  message: 'Không có email tenant',
                });
              }
            } else {
              results.skipped++;
              results.details.push({
                checkinId: checkin._id,
                status: 'skipped',
                message: 'Đã thanh toán hóa đơn CONTRACT',
              });
            }
          }
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          checkinId: checkin._id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng khi gửi email cảnh báo hết hạn:', error);
    throw error;
  }
}

/**
 * Gửi email cảnh báo hết hạn
 */
async function sendExpirationWarningEmail(checkin, daysRemaining) {
  const tenant = checkin.tenantId;
  const room = checkin.roomId;
  const receiptBill = checkin.receiptBillId;
  const hoursRemaining = Math.ceil(daysRemaining * 24);

  const subject = `⚠️ Cảnh báo: Phiếu thu đặt cọc sẽ hết hạn trong ${hoursRemaining} giờ`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .warning-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>⚠️ Cảnh báo hết hạn phiếu thu đặt cọc</h2>
        </div>
        <div class="content">
          <p>Xin chào <strong>${tenant?.fullName || 'Quý khách'}</strong>,</p>
          
          <div class="warning-box">
            <strong>⚠️ Lưu ý quan trọng:</strong> Phiếu thu đặt cọc của bạn sẽ hết hạn trong <strong>${hoursRemaining} giờ</strong> (${Math.ceil(daysRemaining)} ngày).
          </div>

          <div class="info-box">
            <h3>Thông tin phiếu thu:</h3>
            <ul>
              <li><strong>Phòng:</strong> ${room?.roomNumber || 'N/A'}</li>
              <li><strong>Số tiền cọc:</strong> ${receiptBill?.amountDue ? new Intl.NumberFormat('vi-VN').format(Number(receiptBill.amountDue)) : 'N/A'} VNĐ</li>
              <li><strong>Ngày thanh toán:</strong> ${checkin.receiptPaidAt ? new Date(checkin.receiptPaidAt).toLocaleDateString('vi-VN') : 'N/A'}</li>
              <li><strong>Thời hạn:</strong> 3 ngày kể từ ngày thanh toán</li>
            </ul>
          </div>

          <p><strong>Để giữ phòng, bạn cần:</strong></p>
          <ol>
            <li>Thanh toán hóa đơn tháng đầu tiên (CONTRACT bill)</li>
            <li>Hoàn tất ký hợp đồng</li>
          </ol>

          <p>Nếu không hoàn tất trong thời hạn, phiếu thu đặt cọc sẽ bị hủy và bạn sẽ <strong>mất 100% tiền cọc</strong>.</p>

          <p style="margin-top: 20px;">Vui lòng đăng nhập vào hệ thống để xem chi tiết và thanh toán ngay.</p>
          
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

  console.log(`✅ Đã gửi email cảnh báo hết hạn đến ${tenant.email}`);
}

/**
 * Gửi email thông báo hủy do hết hạn
 */
async function sendExpirationCancelEmail(checkin) {
  const tenant = checkin.tenantId;
  const room = checkin.roomId;
  const receiptBill = checkin.receiptBillId;

  const subject = `❌ Thông báo: Phiếu thu đặt cọc đã bị hủy do quá hạn`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .warning-box { background-color: #ffebee; border: 2px solid #f44336; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #f44336; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>❌ Phiếu thu đặt cọc đã bị hủy</h2>
        </div>
        <div class="content">
          <p>Xin chào <strong>${tenant?.fullName || 'Quý khách'}</strong>,</p>
          
          <div class="warning-box">
            <strong>❌ Thông báo:</strong> Phiếu thu đặt cọc của bạn đã bị hủy do quá thời hạn 3 ngày mà chưa thanh toán hóa đơn tháng đầu tiên và hoàn tất hợp đồng.
          </div>

          <div class="info-box">
            <h3>Thông tin phiếu thu:</h3>
            <ul>
              <li><strong>Phòng:</strong> ${room?.roomNumber || 'N/A'}</li>
              <li><strong>Số tiền cọc:</strong> ${receiptBill?.amountDue ? new Intl.NumberFormat('vi-VN').format(Number(receiptBill.amountDue)) : 'N/A'} VNĐ</li>
              <li><strong>Ngày thanh toán:</strong> ${checkin.receiptPaidAt ? new Date(checkin.receiptPaidAt).toLocaleDateString('vi-VN') : 'N/A'}</li>
              <li><strong>Trạng thái:</strong> Đã hủy - Mất 100% tiền cọc</li>
            </ul>
          </div>

          <p><strong>Lý do hủy:</strong> Quá thời hạn 3 ngày mà chưa thanh toán hóa đơn tháng đầu tiên và hoàn tất hợp đồng.</p>

          <p style="margin-top: 20px;">Nếu bạn có thắc mắc, vui lòng liên hệ với ban quản lý.</p>
          
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

  console.log(`✅ Đã gửi email thông báo hủy đến ${tenant.email}`);
}

