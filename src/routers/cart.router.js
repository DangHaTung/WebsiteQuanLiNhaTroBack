import express from 'express'
import { addToCart, getCart, removeFromCart, updateCartItem } from '../controllers/cart.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = express.Router()

// Lấy giỏ hàng của user
router.get('/', authenticate, getCart)

// Thêm sản phẩm vào giỏ
router.post('/add', authenticate, addToCart)

// Xóa sản phẩm khỏi giỏ
router.delete('/item/:productId', authenticate, removeFromCart)

// Cập nhật số lượng sản phẩm trong giỏ
router.put('/item/:productId', authenticate, updateCartItem)

export default router 