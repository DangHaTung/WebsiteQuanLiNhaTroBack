import express from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { checkRole } from '../middlewares/role.middleware.js'
import { createUserBySuperAdmin, 
        getAllUsers, 
        getPaginatedUsers, 
        getUserById, 
        softDeleteUser, 
        updateUserById 
    } from '../controllers/super-admin/user.controller.js'
import productRouter from './product.router.js'
import categoryRouter from './category.router.js'
const router = express.Router()

// Route test sẵn có
router.get('/dashboard', authenticate, checkRole(['super_admin']), (req, res) => {
  res.json({ msg: 'Chào mừng Super Admin!' });
})
router.use('/product', authenticate, checkRole(['super_admin']), productRouter)
router.use('/category', authenticate, checkRole(['super_admin']), categoryRouter)
// Thêm route lấy danh sách user
router.get('/users', authenticate, checkRole(['super_admin']), getAllUsers)
router.get('/users/:id', authenticate, checkRole(['super_admin']), getUserById);
router.put('/users/:id', authenticate, checkRole(['super_admin']), updateUserById)
router.delete('/users/:id', authenticate, checkRole(['super_admin']), softDeleteUser)
router.post('/users', authenticate, checkRole(['super_admin']), createUserBySuperAdmin)
router.get('/users/paginated', authenticate, checkRole(['super_admin']), getPaginatedUsers)
export default router