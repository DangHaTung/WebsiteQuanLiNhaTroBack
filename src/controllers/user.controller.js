import bcrypt from "bcrypt";
import User from "../models/user.model.js";

// Lấy danh sách người dùng (hỗ trợ phân trang, lọc role, tìm kiếm keyword)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, keyword } = req.query;
    const numericLimit = Math.max(parseInt(limit, 10) || 10, 1);
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (numericPage - 1) * numericLimit;

    const query = {};
    if (role) query.role = role;
    if (keyword) {
      const regex = new RegExp(keyword.trim(), "i");
      query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .limit(numericLimit)
        .skip(skip)
        .select("fullName email phone role createdAt"),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách người dùng thành công",
      data: users,
      pagination: {
        currentPage: numericPage,
        totalPages: Math.ceil(total / numericLimit),
        totalRecords: total,
        limit: numericLimit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách người dùng",
      error: error.message,
    });
  }
};

// Lấy thông tin người dùng theo ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("fullName email phone role createdAt");
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.status(200).json({ success: true, message: "Lấy người dùng thành công", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy người dùng", error: error.message });
  }
};

// Tạo người dùng mới (dành cho ADMIN/STAFF tạo tài khoản)
export const createUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email đã tồn tại" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, email, phone, passwordHash, role: role || "TENANT" });
    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Tạo người dùng thành công",
      data: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi tạo người dùng", error: error.message });
  }
};

// Cập nhật người dùng
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, role, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Kiểm tra email trùng nếu có thay đổi
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email đã tồn tại" });
      }
      user.email = email;
    }

    if (typeof fullName === "string") user.fullName = fullName;
    if (typeof phone === "string") user.phone = phone;
    if (typeof role === "string") user.role = role;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
      }
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật người dùng thành công",
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật người dùng", error: error.message });
  }
};

// Xóa người dùng
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.status(200).json({ success: true, message: "Xóa người dùng thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi xóa người dùng", error: error.message });
  }
};


