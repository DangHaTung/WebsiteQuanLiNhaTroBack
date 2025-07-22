import qs from 'qs'
import crypto from 'crypto'
import dotenv from 'dotenv'
dotenv.config()

export const createVnpayPayment = (req, res) => {
  const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip
  const tmnCode = process.env.VNP_TMNCODE
  const secretKey = process.env.VNP_HASHSECRET
  const vnpUrl = process.env.VNP_URL
  const returnUrl = process.env.VNP_RETURNURL

  const { amount, orderId } = req.body
  if (!amount || !orderId) {
    return res.status(400).json({ msg: 'Thiếu amount hoặc orderId' })
  }

  const date = new Date()
  const createDate =
    date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') +
    date.getHours().toString().padStart(2, '0') +
    date.getMinutes().toString().padStart(2, '0') +
    date.getSeconds().toString().padStart(2, '0')

  const vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100, // VNPay yêu cầu x100
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr === '::1' ? '127.0.0.1' : ipAddr,
    vnp_CreateDate: createDate
  }

  // Bước 1: Sort params theo key
  const sortedParams = Object.keys(vnp_Params).sort().reduce((acc, key) => {
    acc[key] = vnp_Params[key]
    return acc
  }, {})

  // Bước 2: Tạo query string
  const signData = qs.stringify(sortedParams, { encode: false })

  // Bước 3: Tạo secure hash
  const hmac = crypto.createHmac('sha512', secretKey)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')
  console.log('signed:', signed);
  // Bước 4: Thêm secure hash vào params
  sortedParams['vnp_SecureHash'] = signed

  // Bước 5: Tạo URL thanh toán
  const paymentUrl = `${vnpUrl}?${qs.stringify(sortedParams, { encode: true })}`

  res.json({ paymentUrl })

} 