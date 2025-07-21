
import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import authRouter from './routers/auth.router.js'
import superadminRouter from './routers/superadmin.router.js'
import productRouter from './routers/product.router.js';
import categoryRouter from './routers/category.router.js'

dotenv.config()

const app = express()
app.use((req, res, next) => {
  next()
})

// ✅ Mở toàn bộ CORS cho phép frontend truy cập
app.use(cors());


// ✅ Luôn để sau cors
app.use(express.json())

// ✅ Đặt sau express.json()
app.use('/api', authRouter)

app.use('/api/super-admin', superadminRouter)

app.use('/api/product', productRouter)

app.use('/api/categories', categoryRouter)

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