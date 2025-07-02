import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// ========== [REGISTER] ==========
export const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ msg: "Vui lòng điền đầy đủ thông tin." });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ msg: "Email không hợp lệ." });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    if (!validator.isMobilePhone(phone, 'vi-VN')) {
      return res.status(400).json({ msg: "Số điện thoại không hợp lệ." });
    }

    // 2. Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ msg: "Email đã được sử dụng." });
    }

    // 3. Mã hoá mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Tạo người dùng
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address
    });

    res.status(201).json({ msg: "Đăng ký thành công!" });

  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
    res.status(500).json({ msg: "Lỗi máy chủ." });
  }
};
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return res.status(400).json({ msg: "Vui lòng nhập email và mật khẩu." });
    }

    // 2. Tìm user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "Không tìm thấy người dùng." });
    }

    // 3. So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Sai mật khẩu." });
    }

    // 4. Tạo JWT
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role
      }
    });

  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ msg: "Lỗi máy chủ." });
  }
};