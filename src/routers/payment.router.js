import express from 'express'
import { createVnpayPayment } from '../controllers/payment.controller.js'
import { createMomoPayment, handleMomoNotify } from '../controllers/momo.controller.js'

const router = express.Router()

router.post('/vnpay', createVnpayPayment)
router.post('/momo', createMomoPayment)
router.post('/momo-notify', handleMomoNotify)

export default router 