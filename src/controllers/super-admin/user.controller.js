import bcrypt from 'bcrypt'
import validator from 'validator'
import User from '../../models/user.model.js'
import Role from '../../models/role.model.js'


export const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query

    const query = { isDeleted: false }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    const users = await User.find(query).populate('role', 'name')
    res.status(200).json({ users })
  } catch (err) {
    console.error('❌ Lỗi khi lấy danh sách người dùng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Tìm user, loại user bị xoá
    const user = await User.findOne({ _id: id, isDeleted: false }).populate('role', 'name');

    if (!user) {
      return res.status(404).json({ msg: 'Không tìm thấy người dùng.' });
    }

    // 2. Loại bỏ password trước khi trả về
    const { password, ...safeUser } = user.toObject();
    res.status(200).json(safeUser);

  } catch (err) {
    console.error('❌ Lỗi khi lấy thông tin người dùng:', err);
    res.status(500).json({ msg: 'Lỗi máy chủ.' });
  }
};
export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, phone, address, roleName, role } = req.body

    const user = await User.findOne({ _id: id, isDeleted: false })
    if (!user) {
      return res.status(404).json({ msg: 'Người dùng không tồn tại.' })
    }

    // Cập nhật các trường nếu có
    if (name) user.name = name
    if (email) user.email = email
    if (phone) user.phone = phone
    if (address) user.address = address
    if (roleName) {
      const roleDoc = await Role.findOne({ name: roleName });
      if (!roleDoc) {
        return res.status(400).json({ msg: 'Role không hợp lệ.' });
      }
      user.role = roleDoc._id;
    } else if (typeof role === 'string') {
      const roleDoc = await Role.findOne({ name: role });
      if (!roleDoc) {
        return res.status(400).json({ msg: 'Role không hợp lệ.' });
      }
      user.role = roleDoc._id;
    } else if (role) {
      user.role = role;
    }

    await user.save()

    res.status(200).json({ msg: 'Cập nhật người dùng thành công.', user })
  } catch (err) {
    console.error('❌ Lỗi cập nhật người dùng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}
export const softDeleteUser = async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findOne({ _id: id, isDeleted: false })
    if (!user) {
      return res.status(404).json({ msg: 'Người dùng không tồn tại hoặc đã bị xóa.' })
    }

    user.isDeleted = true
    await user.save()

    res.status(200).json({ msg: 'Đã xóa người dùng (mềm) thành công.' })
  } catch (err) {
    console.error('❌ Lỗi xoá người dùng:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}
export const createUserBySuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, address, roleName, role } = req.body;

    // Validate cơ bản
    if (!validator.isEmail(email)) {
      return res.status(400).json({ msg: 'Email không hợp lệ.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ msg: 'Mật khẩu tối thiểu 6 ký tự.' });
    }
    if (!validator.isMobilePhone(phone, 'vi-VN')) {
      return res.status(400).json({ msg: 'Số điện thoại không hợp lệ.' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ msg: 'Email đã được sử dụng.' });
    }

    // Xử lý role
    let roleId;
    if (roleName) {
      const roleDoc = await Role.findOne({ name: roleName });
      if (!roleDoc) {
        return res.status(400).json({ msg: 'Role không hợp lệ.' });
      }
      roleId = roleDoc._id;
    } else if (typeof role === 'string') {
      const roleDoc = await Role.findOne({ name: role });
      if (!roleDoc) {
        return res.status(400).json({ msg: 'Role không hợp lệ.' });
      }
      roleId = roleDoc._id;
    } else if (role) {
      roleId = role;
    }

    // Hash password trước khi lưu
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: roleId,
    });
    res.status(201).json({ user });
  } catch (err) {
    console.error('❌ Lỗi tạo user:', err);
    res.status(500).json({ msg: 'Lỗi máy chủ.' });
  }
};
export const getPaginatedUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '' } = req.query

    const query = {
      isDeleted: false,
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
      ],
    }

    const total = await User.countDocuments(query)

    const users = await User.find(query)
      .populate('role', 'name')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      users,
    })
  } catch (err) {
    console.error('❌ Lỗi phân trang user:', err)
    res.status(500).json({ msg: 'Lỗi máy chủ.' })
  }
}