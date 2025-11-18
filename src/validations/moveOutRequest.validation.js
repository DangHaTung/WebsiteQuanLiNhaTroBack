import Joi from 'joi';

// Schema cho tạo move-out request
export const createMoveOutRequestSchema = Joi.object({
  contractId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ContractId phải là ObjectId hợp lệ',
      'any.required': 'ContractId là bắt buộc',
    }),

  moveOutDate: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'MoveOutDate phải có định dạng ISO 8601',
      'any.required': 'MoveOutDate là bắt buộc',
    }),

  reason: Joi.string()
    .trim()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Reason không được để trống',
      'string.min': 'Reason phải có ít nhất 10 ký tự',
      'string.max': 'Reason không được vượt quá 500 ký tự',
      'any.required': 'Reason là bắt buộc',
    }),
});

// Schema cho cập nhật status move-out request
export const updateMoveOutRequestStatusSchema = Joi.object({
  status: Joi.string()
    .valid('APPROVED', 'REJECTED')
    .required()
    .messages({
      'any.only': 'Status phải là APPROVED hoặc REJECTED',
      'any.required': 'Status là bắt buộc',
    }),

  adminNote: Joi.string()
    .trim()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.max': 'AdminNote không được vượt quá 500 ký tự',
    }),
});

// Schema cho params
export const moveOutRequestParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});

