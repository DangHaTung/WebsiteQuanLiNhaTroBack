import Joi from 'joi';

// Schema cho tạo tenant mới
export const createTenantSchema = Joi.object({
  fullName: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'string.empty': 'FullName không được để trống',
      'string.min': 'FullName phải có ít nhất 2 ký tự',
      'string.max': 'FullName không được vượt quá 100 ký tự',
      'any.required': 'FullName là bắt buộc',
    }),

  phone: Joi.string()
    .pattern(/^[0-9]{9,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone phải từ 9-11 chữ số',
    }),

  address: Joi.string()
    .trim()
    .max(300)
    .optional()
    .messages({
      'string.max': 'Address không được vượt quá 300 ký tự',
    }),

  identityNo: Joi.string()
    .pattern(/^[0-9]{9,12}$/)
    .optional()
    .messages({
      'string.pattern.base': 'IdentityNo phải từ 9-12 chữ số',
    }),

  note: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Note không được vượt quá 500 ký tự',
    }),
});

// Schema cho cập nhật tenant
export const updateTenantSchema = Joi.object({
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.empty': 'FullName không được để trống',
      'string.min': 'FullName phải có ít nhất 2 ký tự',
      'string.max': 'FullName không được vượt quá 100 ký tự',
    }),

  phone: Joi.string()
    .pattern(/^[0-9]{9,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone phải từ 9-11 chữ số',
    }),

  address: Joi.string()
    .trim()
    .max(300)
    .optional()
    .messages({
      'string.max': 'Address không được vượt quá 300 ký tự',
    }),

  identityNo: Joi.string()
    .pattern(/^[0-9]{9,12}$/)
    .optional()
    .messages({
      'string.pattern.base': 'IdentityNo phải từ 9-12 chữ số',
    }),

  note: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Note không được vượt quá 500 ký tự',
    }),
})
  .min(1)
  .messages({
    'object.min': 'Phải cung cấp ít nhất một trường để cập nhật',
  });

// Schema cho params
export const tenantParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});