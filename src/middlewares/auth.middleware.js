import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// Middleware xác thực JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-passwordHash");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Token verification failed.",
      error: error.message,
    });
  }
};

// Middleware kiểm tra quyền truy cập theo role
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(", ")}`,
        userRole: req.user.role,
      });
    }

    next();
  };
};

// Middleware kiểm tra quyền sở hữu resource
export const requireOwnership = (resourceIdParam = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Admin có thể truy cập tất cả
    if (req.user.role === "ADMIN") {
      return next();
    }

    // Kiểm tra quyền sở hữu
    const resourceId = req.params[resourceIdParam];
    const userId = req.user._id.toString();

    // Nếu là tenant, chỉ có thể truy cập resource của chính mình
    if (req.user.role === "TENANT" && resourceId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resources.",
      });
    }

    next();
  };
};

// Middleware optional authentication (không bắt buộc phải đăng nhập)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-passwordHash");
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Bỏ qua lỗi và tiếp tục mà không có user
    next();
  }
};
