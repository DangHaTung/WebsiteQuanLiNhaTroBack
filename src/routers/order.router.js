import express from 'express'
import { createOrder, getUserOrders, getAllOrders, updateOrderStatus } from '../controllers/order.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { checkRole } from '../middlewares/role.middleware.js'

const router = express.Router()

// Tạo mới đơn hàng từ giỏ hàng
router.post('/', authenticate, createOrder)

// Lấy danh sách đơn hàng của user
router.get('/', authenticate, getUserOrders)

// Lấy tất cả đơn hàng (super admin)
router.get('/all', authenticate, checkRole(['super_admin']), getAllOrders)

// Cập nhật trạng thái đơn hàng (super admin)
router.put('/:id', authenticate, checkRole(['super_admin']), updateOrderStatus)

export default router 