import User from '../models/user.model.js';
import Role from '../models/role.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import nodemailer from 'nodemailer';
import { registerSchema, loginSchema } from '../validations/auth.validation.js';


const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// ========== [REGISTER] ==========
export const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // 1. Validate dữ liệu đầu vào với Joi
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ msg: error.details[0].message });
    }

    // 2. Kiểm tra định dạng email và số điện thoại
    if (!validator.isEmail(email)) {
      return res.status(400).json({ msg: "Email không hợp lệ." });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    if (!validator.isMobilePhone(phone, 'vi-VN')) {
      return res.status(400).json({ msg: "Số điện thoại không hợp lệ." });
    }

    // 3. Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ msg: "Email đã được sử dụng." });
    }

    // 4. Mã hoá mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Lấy role "customer" từ bảng Role
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      return res.status(500).json({ msg: "Không tìm thấy role mặc định." });
    }

    // 6. Tạo người dùng với role là customer
    await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: customerRole._id,
    });

    return res.status(201).json({ msg: "Đăng ký thành công!" });

  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
    return res.status(500).json({ msg: "Lỗi máy chủ." });
  }
};
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào
   const { error } = loginSchema.validate(req.body);
if (error) {
  return res.status(400).json({ msg: error.details[0].message });
}
    // 2. Tìm user
    const user = await User.findOne({ email }).populate('role');
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

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password'); // bỏ mật khẩu

    if (!user) {
      return res.status(404).json({ msg: 'Không tìm thấy người dùng.' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Lỗi lấy profile:', err);
    res.status(500).json({ msg: 'Lỗi máy chủ.' });
  }
};
export const sendResetCode = async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ msg: 'Email là bắt buộc' })

  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ msg: 'Không tìm thấy người dùng' })

  const otp = Math.floor(100000 + Math.random() * 900000) // ví dụ: 6 số

  user.resetCode = otp
  user.resetCodeExpires = Date.now() + 10 * 60 * 1000 // 10 phút hết hạn
  await user.save()

  // cấu hình transport
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Mã xác thực đặt lại mật khẩu',
    text: `Mã xác thực của bạn là: ${otp}`,
  }

  await transporter.sendMail(mailOptions)

  res.json({ msg: 'Đã gửi mã xác thực đến email!' })
}
export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body
  const user = await User.findOne({ email })

  if (
    !user ||
    user.resetCode !== Number(code) ||
    user.resetCodeExpires < Date.now()
  ) {
    return res.status(400).json({ msg: 'Mã không hợp lệ hoặc đã hết hạn' })
  }

  res.json({ msg: 'Mã hợp lệ, cho phép đổi mật khẩu' })
}

export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body

  try {
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ msg: 'Người dùng không tồn tại' })

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword

    // Xóa mã xác thực cũ nếu có
    user.resetCode = undefined
    user.resetCodeExpires = undefined

    await user.save()

    res.json({ msg: 'Cập nhật mật khẩu thành công!' })
  } catch (err) {
    console.error('❌ Lỗi reset password:', err)
    res.status(500).json({ msg: 'Lỗi server' })
  }
}