import mongoose from 'mongoose'

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['customer', 'admin', 'super_admin'],
    required: true,
    unique: true,
  },
})

const Role = mongoose.model('Role', roleSchema)
export default Role