import express from 'express'
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  softDeleteProduct
} from '../controllers/super-admin/product.controller.js'

import { authenticate } from '../middlewares/auth.middleware.js'
import { checkRole } from '../middlewares/role.middleware.js'
import upload from '../middlewares/upload.middleware.js'

const router = express.Router()

// Upload nhiều hình ảnh cho sản phẩm
router.post('/', authenticate, checkRole(['super_admin']), upload.array('images', 5), createProduct)
router.get('/', getAllProducts)
router.get('/:id', getProductById)
router.put('/:id', authenticate, checkRole(['super_admin']), upload.array('images', 5), updateProduct)
router.delete('/:id', authenticate, checkRole(['super_admin']), softDeleteProduct)

export default router