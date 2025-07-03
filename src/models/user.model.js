import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  address: String,
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
  },
})

const User = mongoose.model('User', userSchema)
export default User