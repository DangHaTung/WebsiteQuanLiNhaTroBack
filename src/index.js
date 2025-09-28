import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'

dotenv.config()

const app = express()
app.use((req, res, next) => {
  next()
})

//  Mở toàn bộ CORS cho phép frontend truy cập
app.use(cors());


// Luôn để sau cors
app.use(express.json())

// Đặt sau express.json()


//  Kết nối DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Kết nối MongoDB thành công')
    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
      console.log(`Server đang chạy tại http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Lỗi MongoDB:', err)
  })
