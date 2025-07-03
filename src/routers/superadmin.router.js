import express from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { checkRole } from '../middlewares/role.middleware.js'

const router = express.Router()

router.get('/dashboard', authenticate, checkRole(['super admin']), (req, res) => {
  res.json({ msg: 'Chào mừng Super Admin!' });
});

export default router