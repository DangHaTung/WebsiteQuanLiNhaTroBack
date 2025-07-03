import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Role from '../src/models/role.model.js'

dotenv.config()

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    const roles = ['customer', 'admin', 'super_admin']

    for (const name of roles) {
      const exists = await Role.findOne({ name })
      if (!exists) await Role.create({ name })
    }

    console.log('✅ Đã tạo role thành công')
    process.exit()
  })
  .catch((err) => {
    console.error('❌ Lỗi khi tạo role:', err)
    process.exit(1)
  })