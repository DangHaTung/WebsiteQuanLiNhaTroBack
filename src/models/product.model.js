import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String }], // Thêm trường images để lưu đường dẫn hình ảnh
  isDeleted: { type: Boolean, default: false },

}, { timestamps: true })

export default mongoose.model('Product', productSchema)