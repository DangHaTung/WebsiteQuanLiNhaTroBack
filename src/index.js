
import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import authRouter from './routers/auth.router.js'
import adminRouter from './routers/admin.router.js'
import superadminRouter from './routers/superadmin.router.js'

dotenv.config()

const app = express()

// ✅ Mở toàn bộ CORS cho phép frontend truy cập
app.use(cors());


// ✅ Luôn để sau cors
app.use(express.json())

// ✅ Đặt sau express.json()
app.use('/api', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/super-admin', superadminRouter)

// ✅ Kết nối DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Kết nối MongoDB thành công')
    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('❌ Lỗi MongoDB:', err)
  })