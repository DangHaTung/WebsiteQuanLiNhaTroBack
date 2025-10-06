import Joi from "joi";

export const registerSchema = Joi.object({
  fullName: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Họ tên không được bỏ trống",
    "string.min": "Họ tên phải có ít nhất 3 ký tự",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "string.empty": "Email không được bỏ trống",
  }),

  phone: Joi.string()
    .pattern(/^[0-9]{9,11}$/)
    .messages({
      "string.pattern.base": "Số điện thoại phải từ 9–11 chữ số",
    }),

  password: Joi.string().min(6).required().messages({
    "string.empty": "Mật khẩu không được bỏ trống",
    "string.min": "Mật khẩu phải ít nhất 6 ký tự",
  }),

  role: Joi.string()
    .valid("ADMIN", "LANDLORD", "TENANT", "STAFF")
    .default("TENANT"), // nếu không truyền, tự set TENANT
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "string.empty": "Email không được bỏ trống",
  }),

  password: Joi.string().required().messages({
    "string.empty": "Mật khẩu không được bỏ trống",
  }),
});