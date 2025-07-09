import express from 'express'
import { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory } from '../controllers/super-admin/category.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { checkRole } from '../middlewares/role.middleware.js'

const router = express.Router()

router.post('/', authenticate, checkRole(['super_admin']), createCategory)
router.get('/', getAllCategories)
router.get('/:id', getCategoryById)
router.put('/:id', authenticate, checkRole(['super_admin']), updateCategory)
router.delete('/:id', authenticate, checkRole(['super_admin']), deleteCategory)

export default router