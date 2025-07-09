import Product from '../../models/product.model.js'
import Category from '../../models/category.model.js'
import mongoose from 'mongoose'

// Tạo sản phẩm mới
export const createProduct = async (req, res) => {
    try {
      const { name, description, price, category } = req.body
  
      if (!name || !price || !category) {
        return res.status(400).json({ msg: 'Thiếu thông tin bắt buộc.' })
      }
  
      const categoryExists = await Category.findById(category)
      if (!categoryExists) {
        return res.status(404).json({ msg: 'Danh mục không tồn tại.' })
      }

      // Xử lý hình ảnh từ req.files
      const images = req.files ? req.files.map(file => file.path) : []
  
      const product = await Product.create({ 
        name, 
        description, 
        price, 
        category,
        images 
      })
      res.status(201).json({ msg: 'Tạo sản phẩm thành công!', product })
    } catch (err) {
      console.error('❌ Lỗi tạo sản phẩm:', err)
      res.status(500).json({ msg: 'Lỗi máy chủ.', error: err.message, stack: err.stack })
    }
  }

// Lấy danh sách sản phẩm (có tìm kiếm theo tên và phân trang)
export const getAllProducts = async (req, res) => {
    try {
      const { page = 1, limit = 10, keyword = '', categoryId } = req.query;
  
      const query = {
        isDeleted: false,
        name: { $regex: keyword, $options: 'i' },
      };
  
      // Nếu có categoryId thì thêm điều kiện lọc theo danh mục
      if (categoryId) {
        query.category = categoryId;
      }
  
      const total = await Product.countDocuments(query);
      const products = await Product.find(query)
        .populate('category', 'name')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ createdAt: -1 });
  
      res.json({
        total,
        page: Number(page),
        limit: Number(limit),
        products,
      });
    } catch (err) {
      console.error('❌ Lỗi lấy danh sách sản phẩm:', err);
      res.status(500).json({ msg: 'Lỗi máy chủ.' });
    }
  };

// Lấy chi tiết sản phẩm
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'ID không hợp lệ.' })
    }

    const product = await Product.findOne({ _id: id, isDeleted: false }).populate('category', 'name')
    if (!product) {
      return res.status(404).json({ msg: 'Không tìm thấy sản phẩm.' })
    }

    res.json(product)
  } catch (err) {
    console.error('❌ Lỗi lấy sản phẩm:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Cập nhật sản phẩm
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const { name, price, description, category } = req.body

    const product = await Product.findOne({ _id: id, isDeleted: false })
    if (!product) {
      return res.status(404).json({ msg: 'Không tìm thấy sản phẩm.' })
    }

    if (category) {
      const categoryExists = await Category.findById(category)
      if (!categoryExists) {
        return res.status(400).json({ msg: 'Danh mục không tồn tại.' })
      }
      product.category = category
    }

    if (name) product.name = name
    if (price) product.price = price
    if (description !== undefined) product.description = description

    // Xử lý hình ảnh mới nếu có
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.path)
      product.images = newImages
    }

    await product.save()
    res.json({ msg: 'Cập nhật sản phẩm thành công.', product })
  } catch (err) {
    console.error('❌ Lỗi cập nhật sản phẩm:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

// Xoá mềm sản phẩm
export const softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params

    const product = await Product.findOne({ _id: id, isDeleted: false })
    if (!product) {
      return res.status(404).json({ msg: 'Sản phẩm không tồn tại hoặc đã bị xoá.' })
    }

    product.isDeleted = true
    await product.save()

    res.json({ msg: 'Đã xoá sản phẩm (mềm) thành công.' })
  } catch (err) {
    console.error('❌ Lỗi xoá sản phẩm:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}
