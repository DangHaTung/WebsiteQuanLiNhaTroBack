import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

// Middleware xác thực JWT
export const authenticateToken = async (req, res, next) => {
  console.log('[authenticateToken] headers.authorization=', req.headers.authorization);
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token không được cung cấp',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm user để đảm bảo user vẫn tồn tại
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ - User không tồn tại',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực token',
      error: error.message,
    });
  }
};

// Middleware kiểm tra quyền truy cập
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập',
        requiredRoles: roles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

// Middleware kiểm tra quyền sở hữu hoặc admin
export const authorizeOwnerOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực',
      });
    }

    // Admin có thể truy cập tất cả
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Kiểm tra quyền sở hữu
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Không có quyền truy cập tài nguyên này',
    });
  };
};

// Optional auth: nếu có token thì gán req.user, nếu không có thì tiếp tục (không trả 401)
export const optionalAuth = async (req, res, next) => {
  console.log('[optionalAuth] headers.authorization=', req.headers.authorization);
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) return next(); // không có token -> tiếp tục (public)

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (user) req.user = user;
    } catch (err) {
      // token không hợp lệ -> bỏ qua, không trả 401
      console.warn('optionalAuth: invalid token', err?.message || err);
    }
    next();
  } catch (err) {
    next();
  }
};
