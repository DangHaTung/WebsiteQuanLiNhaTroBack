import Order from '../models/order.model.js'
import Cart from '../models/cart.model.js'
import Product from '../models/product.model.js'

// Tạo mới đơn hàng từ giỏ hàng
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id
    const { address, phone, note, paymentMethod } = req.body
    if (!address || !phone) {
      return res.status(400).json({ msg: 'Thiếu địa chỉ hoặc số điện thoại.' })
    }
    // Lấy giỏ hàng của user
    const cart = await Cart.findOne({ user: userId }).populate('items.product')
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ msg: 'Giỏ hàng trống.' })
    }
    // Chuẩn bị dữ liệu đơn hàng
    let total = 0
    const items = cart.items.map(item => {
      if (!item.product || item.product.isDeleted) return null
      total += item.product.price * item.quantity
      return {
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price
      }
    }).filter(Boolean)
    if (items.length === 0) {
      return res.status(400).json({ msg: 'Không có sản phẩm hợp lệ trong giỏ.' })
    }
    // Tạo đơn hàng
    let paymentStatus = 'unpaid';
    if (paymentMethod === 'momo') paymentStatus = 'paid';
    else if (paymentMethod === 'vnpay') paymentStatus = 'paid'; // Nếu muốn chỉ momo thì bỏ dòng này
    const order = await Order.create({
      user: userId,
      items,
      total,
      address,
      phone,
      note,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus
    })
    // Xóa giỏ hàng sau khi đặt hàng thành công
    cart.items = []
    await cart.save()
    res.status(201).json({ msg: 'Đặt hàng thành công!', order })
  } catch (err) {
    console.error('❌ Lỗi tạo đơn hàng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Lấy danh sách đơn hàng của user
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).populate('items.product')
    res.json({ orders })
  } catch (err) {
    console.error('❌ Lỗi lấy đơn hàng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Lấy tất cả đơn hàng (cho super admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'name email').populate('items.product')
    res.json({ orders })
  } catch (err) {
    console.error('❌ Lỗi lấy tất cả đơn hàng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Cập nhật trạng thái đơn hàng
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const validStatus = [
      'pending', 'confirmed', 'shipping', 'completed', 'cancelled',
      'Chờ xác nhận', 'Đã xác nhận', 'Đang giao hàng', 'Đã hoàn thành', 'Đã hủy'
    ];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ msg: 'Trạng thái không hợp lệ.' })
    }
    let update = { status };
    if (
      status === 'completed' || status === 'Đã hoàn thành'
    ) {
      update.paymentStatus = 'paid';
    }
    const order = await Order.findByIdAndUpdate(id, update, { new: true }).populate('user', 'name email').populate('items.product')
    if (!order) return res.status(404).json({ msg: 'Không tìm thấy đơn hàng.' })
    res.json({ msg: 'Cập nhật trạng thái thành công.', order })
  } catch (err) {
    console.error('❌ Lỗi cập nhật trạng thái đơn hàng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
} 