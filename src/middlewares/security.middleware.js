import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";

// Rate limiting cho authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 requests per window
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting cho API routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests per window
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting nghiêm ngặt cho sensitive operations
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 requests per window
  message: {
    success: false,
    message: "Too many sensitive operations, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helmet configuration cho security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Middleware sanitize input
export const sanitizeInput = (req, res, next) => {
  // Loại bỏ các ký tự nguy hiểm
  const sanitizeString = (str) => {
    if (typeof str !== "string") return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  };

  // Sanitize body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }

  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === "string") {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }

  next();
};

// Middleware validate MongoDB ObjectId
export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
    }
    
    next();
  };
};

// Middleware log security events
export const securityLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log các response có status code lỗi
    if (res.statusCode >= 400) {
      console.log(`[SECURITY] ${req.method} ${req.path} - Status: ${res.statusCode} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};
