import Joi from 'joi';

export const createUserSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'FullName không được để trống',
    'string.min': 'FullName phải có ít nhất 2 ký tự',
    'string.max': 'FullName không được vượt quá 100 ký tự',
    'any.required': 'FullName là bắt buộc',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'any.required': 'Email là bắt buộc',
  }),
  phone: Joi.string().pattern(/^[0-9]{9,11}$/).optional().messages({
    'string.pattern.base': 'Phone phải từ 9-11 chữ số',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password phải có ít nhất 6 ký tự',
    'any.required': 'Password là bắt buộc',
  }),
  role: Joi.string().valid('ADMIN', 'TENANT').optional().messages({
    'any.only': 'Role không hợp lệ',
  }),
});

export const updateUserSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional().messages({
    'string.empty': 'FullName không được để trống',
    'string.min': 'FullName phải có ít nhất 2 ký tự',
    'string.max': 'FullName không được vượt quá 100 ký tự',
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Email không hợp lệ',
  }),
  phone: Joi.string().pattern(/^[0-9]{9,11}$/).optional().messages({
    'string.pattern.base': 'Phone phải từ 9-11 chữ số',
  }),
  password: Joi.string().min(6).optional().messages({
    'string.min': 'Password phải có ít nhất 6 ký tự',
  }),
  role: Joi.string().valid('ADMIN', 'TENANT').optional().messages({
    'any.only': 'Role không hợp lệ',
  }),
}).min(1).messages({
  'object.min': 'Phải cung cấp ít nhất một trường để cập nhật',
});

export const userParamsSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID phải là ObjectId hợp lệ',
    'any.required': 'ID là bắt buộc',
  }),
});

export const userQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page phải là số',
    'number.integer': 'Page phải là số nguyên',
    'number.min': 'Page phải lớn hơn hoặc bằng 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit phải là số',
    'number.integer': 'Limit phải là số nguyên',
    'number.min': 'Limit phải lớn hơn hoặc bằng 1',
    'number.max': 'Limit không được vượt quá 100',
  }),
  role: Joi.string().valid('ADMIN', 'TENANT').optional().messages({
    'any.only': 'Role không hợp lệ',
  }),
  keyword: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Keyword không được vượt quá 100 ký tự',
  }),
});


