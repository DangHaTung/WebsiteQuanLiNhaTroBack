import axios from 'axios';
import crypto from 'crypto';
import Order from '../models/order.model.js';

export const createMomoPayment = async (req, res) => {
  // Lấy dữ liệu từ body hoặc hardcode test
  const {
    amount = '50000',
    orderInfo = 'pay with MoMo',
    orderGroupId = '',
    autoCapture = true,
    lang = 'vi'
  } = req.body;

  // Thông tin test của MoMo
  const accessKey = 'F8BBA842ECF85';
  const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
  const partnerCode = 'MOMO';
  const requestType = 'payWithMethod';
  const orderId = req.body.orderId || (partnerCode + Date.now());
  const requestId = orderId;
  const extraData = '';
  // Sửa ipnUrl sang LocalTunnel public URL
  const redirectUrl = 'http://localhost:5173/momo-return';
  const ipnUrl = 'https://large-keys-fetch.loca.lt/api/payment/momo-notify';

  // Tạo raw signature
  const rawSignature =
    "accessKey=" + accessKey +
    "&amount=" + amount +
    "&extraData=" + extraData +
    "&ipnUrl=" + ipnUrl +
    "&orderId=" + orderId +
    "&orderInfo=" + orderInfo +
    "&partnerCode=" + partnerCode +
    "&redirectUrl=" + redirectUrl +
    "&requestId=" + requestId +
    "&requestType=" + requestType;

  // Tạo signature
  const signature = crypto.createHmac('sha256', secretKey)
    .update(rawSignature)
    .digest('hex');

  // Tạo body gửi MoMo
  const requestBody = {
    partnerCode,
    partnerName: "Test",
    storeId: "MomoTestStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang,
    requestType,
    autoCapture,
    extraData,
    orderGroupId,
    signature
  };

  try {
    const momoRes = await axios.post('https://test-payment.momo.vn/v2/gateway/api/create', requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });
    // Trả về link thanh toán cho frontend
    return res.json(momoRes.data);
  } catch (err) {
    console.error('Lỗi MoMo:', err.response?.data || err.message);
    return res.status(500).json({ msg: 'Lỗi tạo thanh toán MoMo', error: err.response?.data || err.message });
  }
};

export const handleMomoNotify = async (req, res) => {
    
  try {
    const { orderId, resultCode } = req.body;
    if (!orderId) return res.status(400).json({ msg: 'Thiếu orderId' });
    if (resultCode === 0 || resultCode === '0') {
      // Thanh toán thành công
      const order = await Order.findOneAndUpdate(
        { _id: orderId },
        { paymentStatus: 'paid' },
        { new: true }
      );
      if (!order) return res.status(404).json({ msg: 'Không tìm thấy đơn hàng.' });
      return res.json({ msg: 'Đã cập nhật trạng thái thanh toán MoMo!', order });
    } else {
      return res.json({ msg: 'Thanh toán MoMo thất bại hoặc bị hủy.' });
    }
  } catch (err) {
    console.error('Lỗi handleMomoNotify:', err);
    res.status(500).json({ msg: 'Lỗi máy chủ.' });
  }
}; 