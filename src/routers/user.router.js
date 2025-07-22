import express from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { getMe } from '../controllers/super-admin/user.controller.js'

const router = express.Router()

router.get('/me', authenticate, getMe)

export default router 