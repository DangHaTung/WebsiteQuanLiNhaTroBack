import mongoose from 'mongoose'

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  }
}, { _id: false })

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Mỗi user chỉ có 1 cart
  },
  items: [cartItemSchema],
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

const Cart = mongoose.model('Cart', cartSchema)
export default Cart 