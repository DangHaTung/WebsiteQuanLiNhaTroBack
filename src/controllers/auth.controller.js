import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// Đăng ký người dùng mới
export const register = async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    // Kiểm tra xem email đã tồn tại trong database chưa
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email đã tồn tại" });

    // Hash mật khẩu người dùng trước khi lưu vào DB
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo đối tượng User mới với thông tin nhận được
    const newUser = new User({
      fullName,
      email,
      phone,
      passwordHash: hashedPassword, // Lưu mật khẩu đã hash
      role: role || "TENANT", // Nếu không có role thì mặc định là TENANT
    });

    // Lưu user mới vào database
    await newUser.save();

    // Trả về thông tin user (không bao gồm password) kèm thông báo
    res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    // Nếu có lỗi server, trả về status 500 kèm thông báo lỗi
    res.status(500).json({ error: err.message });
  }
};

// Đăng nhập người dùng
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // kiểm tra user tồn tại
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email hoặc mật khẩu không đúng" });

    // Kiểm tra tài khoản có bị khóa không
    if (user.isLocked) {
      return res.status(403).json({ 
        message: "Tài khoản của bạn đã bị khóa, liên hệ quản trị viên để được hỗ trợ" 
      });
    }

    // Kiểm tra mật khẩu nhập vào với mật khẩu hash trong DB
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Email hoặc mật khẩu không đúng" });

    // Tạo JWT token chứa thông tin user, dùng để xác thực các request sau này
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      process.env.JWT_SECRET, // Secret key trong .env
      { expiresIn: process.env.JWT_EXPIRES_IN } // Thời gian hết hạn token
    );

    // Trả về token và thông tin user (không bao gồm mật khẩu)
    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        username: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    // Nếu có lỗi server, trả về status 500 kèm thông báo lỗi
    res.status(500).json({ error: err.message });
  }
};

// Đặt lại mật khẩu
export const resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id; // Lấy userId từ middleware authenticateToken

    // Tìm user theo ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra mật khẩu hiện tại có đúng không
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    // Hash mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu mới vào database
    await User.findByIdAndUpdate(userId, { passwordHash: hashedNewPassword });

    // Trả về thông báo thành công
    res.json({
      message: "Đặt lại mật khẩu thành công",
      success: true,
    });
  } catch (err) {
    // Nếu có lỗi server, trả về status 500 kèm thông báo lỗi chi tiết
    res.status(500).json({ 
      message: "Lỗi server khi đặt lại mật khẩu",
      error: err.message 
    });
  }
};
