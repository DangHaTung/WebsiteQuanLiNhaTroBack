import Cart from '../models/cart.model.js'
import Product from '../models/product.model.js'

// Thêm sản phẩm vào giỏ hàng
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id
    const { productId, quantity } = req.body
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ msg: 'Thiếu thông tin sản phẩm hoặc số lượng không hợp lệ.' })
    }
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ msg: 'Sản phẩm không tồn tại.' })
    }
    let cart = await Cart.findOne({ user: userId })
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [{ product: productId, quantity }] })
    } else {
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId)
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity
      } else {
        cart.items.push({ product: productId, quantity })
      }
      await cart.save()
    }
    return res.json({ msg: 'Đã thêm vào giỏ hàng.', cart })
  } catch (err) {
    console.error('❌ Lỗi thêm vào giỏ hàng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Lấy giỏ hàng của user và tính tổng tiền
export const getCart = async (req, res) => {
  try {
    const userId = req.user._id
    const cart = await Cart.findOne({ user: userId }).populate('items.product')
    if (!cart) {
      return res.json({ items: [], total: 0 })
    }
    // Tính tổng tiền
    let total = 0
    cart.items.forEach(item => {
      if (item.product && !item.product.isDeleted) {
        total += item.product.price * item.quantity
      }
    })
    res.json({ items: cart.items, total })
  } catch (err) {
    console.error('❌ Lỗi lấy giỏ hàng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Xóa sản phẩm khỏi giỏ hàng
export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id
    const { productId } = req.params
    let cart = await Cart.findOne({ user: userId })
    if (!cart) {
      return res.status(404).json({ msg: 'Giỏ hàng không tồn tại.' })
    }
    cart.items = cart.items.filter(item => item.product.toString() !== productId)
    await cart.save()
    res.json({ msg: 'Đã xóa sản phẩm khỏi giỏ hàng.', cart })
  } catch (err) {
    console.error('❌ Lỗi xóa sản phẩm khỏi giỏ:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Cập nhật số lượng sản phẩm trong giỏ
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id
    const { productId } = req.params
    const { quantity } = req.body
    if (!quantity || quantity < 1) {
      return res.status(400).json({ msg: 'Số lượng không hợp lệ.' })
    }
    let cart = await Cart.findOne({ user: userId })
    if (!cart) {
      return res.status(404).json({ msg: 'Giỏ hàng không tồn tại.' })
    }
    const item = cart.items.find(item => item.product.toString() === productId)
    if (!item) {
      return res.status(404).json({ msg: 'Sản phẩm không có trong giỏ.' })
    }
    item.quantity = quantity
    await cart.save()
    res.json({ msg: 'Đã cập nhật số lượng sản phẩm.', cart })
  } catch (err) {
    console.error('❌ Lỗi cập nhật số lượng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
} 