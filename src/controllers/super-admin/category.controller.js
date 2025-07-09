import Category from '../../models/category.model.js'

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body

    if (!name) {
      return res.status(400).json({ msg: 'Tên danh mục không được để trống.' })
    }

    const existing = await Category.findOne({ name })
    if (existing) {
      return res.status(409).json({ msg: 'Danh mục đã tồn tại.' })
    }

    const category = await Category.create({ name })
    res.status(201).json({ msg: 'Tạo danh mục thành công.', category })
  } catch (err) {
    console.error('❌ Lỗi tạo danh mục:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}

export const getAllCategories = async (req, res) => {
  try {
    const { keyword } = req.query

    const query = { isDeleted: false }

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ]
    }

    const categories = await Category.find(query).sort({ createdAt: -1 })
    res.status(200).json({ categories })
  } catch (err) {
    console.error('❌ Lỗi lấy danh mục:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}   
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params
    const category = await Category.findById(id)
    res.status(200).json({ category })
  } catch (err) {
    console.error('❌ Lỗi lấy danh mục:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params
        const { name } = req.body
        const category = await Category.findByIdAndUpdate(id, { name }, { new: true })
        res.status(200).json({ category })
    } catch (err) {
        console.error('❌ Lỗi cập nhật danh mục:', err)
        res.status(500).json({ msg: 'Lỗi máy chủ.' })
    }
}
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params
        const category = await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true })
        res.status(200).json({ category })
    } catch (err) {
        console.error('❌ Lỗi xoá danh mục:', err)
        res.status(500).json({ msg: 'Lỗi máy chủ.' })
    }
}
