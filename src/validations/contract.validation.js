import Joi from 'joi';

// Schema cho tạo contract mới
export const createContractSchema = Joi.object({
  tenantId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'TenantId phải là ObjectId hợp lệ',
      'any.required': 'TenantId là bắt buộc',
    }),

  roomId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'RoomId phải là ObjectId hợp lệ',
      'any.required': 'RoomId là bắt buộc',
    }),

  startDate: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'StartDate phải có định dạng ISO 8601',
      'any.required': 'StartDate là bắt buộc',
    }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'date.format': 'EndDate phải có định dạng ISO 8601',
      'date.min': 'EndDate phải lớn hơn hoặc bằng StartDate',
      'any.required': 'EndDate là bắt buộc',
    }),

  deposit: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'Deposit phải là số',
      'number.positive': 'Deposit phải là số dương',
      'any.required': 'Deposit là bắt buộc',
    }),

  monthlyRent: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'MonthlyRent phải là số',
      'number.positive': 'MonthlyRent phải là số dương',
      'any.required': 'MonthlyRent là bắt buộc',
    }),

  status: Joi.string()
    .valid('ACTIVE', 'ENDED', 'CANCELED')
    .default('ACTIVE')
    .messages({
      'any.only': 'Status phải là ACTIVE, ENDED hoặc CANCELED',
    }),

  pricingSnapshot: Joi.object({
    roomNumber: Joi.string()
      .trim()
      .max(50)
      .optional()
      .messages({
        'string.max': 'RoomNumber không được vượt quá 50 ký tự',
      }),
    monthlyRent: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.base': 'MonthlyRent phải là số',
        'number.positive': 'MonthlyRent phải là số dương',
      }),
    deposit: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.base': 'Deposit phải là số',
        'number.positive': 'Deposit phải là số dương',
      }),
  })
    .optional()
    .messages({
      'object.base': 'PricingSnapshot phải là object',
    }),
});

// Schema cho cập nhật contract
export const updateContractSchema = Joi.object({
  tenantId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'TenantId phải là ObjectId hợp lệ',
    }),

  roomId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'RoomId phải là ObjectId hợp lệ',
    }),

  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'StartDate phải có định dạng ISO 8601',
    }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.format': 'EndDate phải có định dạng ISO 8601',
      'date.min': 'EndDate phải lớn hơn hoặc bằng StartDate',
    }),

  deposit: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'Deposit phải là số',
      'number.positive': 'Deposit phải là số dương',
    }),

  monthlyRent: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'MonthlyRent phải là số',
      'number.positive': 'MonthlyRent phải là số dương',
    }),

  status: Joi.string()
    .valid('ACTIVE', 'ENDED', 'CANCELED')
    .optional()
    .messages({
      'any.only': 'Status phải là ACTIVE, ENDED hoặc CANCELED',
    }),

  pricingSnapshot: Joi.object({
    roomNumber: Joi.string()
      .trim()
      .max(50)
      .optional()
      .messages({
        'string.max': 'RoomNumber không được vượt quá 50 ký tự',
      }),
    monthlyRent: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.base': 'MonthlyRent phải là số',
        'number.positive': 'MonthlyRent phải là số dương',
      }),
    deposit: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.base': 'Deposit phải là số',
        'number.positive': 'Deposit phải là số dương',
      }),
  })
    .optional()
    .messages({
      'object.base': 'PricingSnapshot phải là object',
    }),
})
  .min(1)
  .messages({
    'object.min': 'Phải cung cấp ít nhất một trường để cập nhật',
  });

// Schema cho params
export const contractParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});