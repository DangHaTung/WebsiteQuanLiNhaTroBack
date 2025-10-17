import Joi from 'joi';

// Schema cho tạo bill mới
export const createBillSchema = Joi.object({
  contractId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ContractId phải là ObjectId hợp lệ',
      'any.required': 'ContractId là bắt buộc',
    }),

  billingDate: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'BillingDate phải có định dạng ISO 8601',
      'any.required': 'BillingDate là bắt buộc',
    }),

  status: Joi.string()
    .valid('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID')
    .default('UNPAID')
    .messages({
      'any.only': 'Status phải là UNPAID, PARTIALLY_PAID, PAID hoặc VOID',
    }),

  lineItems: Joi.array()
    .items(
      Joi.object({
        item: Joi.string()
          .required()
          .trim()
          .min(1)
          .max(100)
          .messages({
            'string.empty': 'Item không được để trống',
            'string.min': 'Item phải có ít nhất 1 ký tự',
            'string.max': 'Item không được vượt quá 100 ký tự',
            'any.required': 'Item là bắt buộc',
          }),
        quantity: Joi.number()
          .integer()
          .min(1)
          .default(1)
          .messages({
            'number.base': 'Quantity phải là số',
            'number.integer': 'Quantity phải là số nguyên',
            'number.min': 'Quantity phải lớn hơn hoặc bằng 1',
          }),
        unitPrice: Joi.number()
          .positive()
          .precision(2)
          .required()
          .messages({
            'number.base': 'UnitPrice phải là số',
            'number.positive': 'UnitPrice phải là số dương',
            'any.required': 'UnitPrice là bắt buộc',
          }),
        lineTotal: Joi.number()
          .positive()
          .precision(2)
          .required()
          .messages({
            'number.base': 'LineTotal phải là số',
            'number.positive': 'LineTotal phải là số dương',
            'any.required': 'LineTotal là bắt buộc',
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Phải có ít nhất 1 line item',
      'any.required': 'LineItems là bắt buộc',
    }),

  amountDue: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'AmountDue phải là số',
      'number.positive': 'AmountDue phải là số dương',
      'any.required': 'AmountDue là bắt buộc',
    }),

  amountPaid: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .messages({
      'number.base': 'AmountPaid phải là số',
      'number.min': 'AmountPaid không được âm',
    }),

  payments: Joi.array()
    .items(
      Joi.object({
        paidAt: Joi.date()
          .iso()
          .required()
          .messages({
            'date.format': 'PaidAt phải có định dạng ISO 8601',
            'any.required': 'PaidAt là bắt buộc',
          }),
        amount: Joi.number()
          .positive()
          .precision(2)
          .required()
          .messages({
            'number.base': 'Amount phải là số',
            'number.positive': 'Amount phải là số dương',
            'any.required': 'Amount là bắt buộc',
          }),
        method: Joi.string()
          .valid('CASH', 'BANK', 'MOMO', 'OTHER')
          .required()
          .messages({
            'any.only': 'Method phải là CASH, BANK, MOMO hoặc OTHER',
            'any.required': 'Method là bắt buộc',
          }),
        note: Joi.string()
          .max(200)
          .optional()
          .messages({
            'string.max': 'Note không được vượt quá 200 ký tự',
          }),
      })
    )
    .optional()
    .messages({
      'array.base': 'Payments phải là mảng',
    }),

  note: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Note không được vượt quá 500 ký tự',
    }),
});

// Schema cho cập nhật bill
export const updateBillSchema = Joi.object({
  contractId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'ContractId phải là ObjectId hợp lệ',
    }),

  billingDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'BillingDate phải có định dạng ISO 8601',
    }),

  status: Joi.string()
    .valid('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID')
    .optional()
    .messages({
      'any.only': 'Status phải là UNPAID, PARTIALLY_PAID, PAID hoặc VOID',
    }),

  lineItems: Joi.array()
    .items(
      Joi.object({
        item: Joi.string()
          .trim()
          .min(1)
          .max(100)
          .messages({
            'string.empty': 'Item không được để trống',
            'string.min': 'Item phải có ít nhất 1 ký tự',
            'string.max': 'Item không được vượt quá 100 ký tự',
          }),
        quantity: Joi.number()
          .integer()
          .min(1)
          .messages({
            'number.base': 'Quantity phải là số',
            'number.integer': 'Quantity phải là số nguyên',
            'number.min': 'Quantity phải lớn hơn hoặc bằng 1',
          }),
        unitPrice: Joi.number()
          .positive()
          .precision(2)
          .messages({
            'number.base': 'UnitPrice phải là số',
            'number.positive': 'UnitPrice phải là số dương',
          }),
        lineTotal: Joi.number()
          .positive()
          .precision(2)
          .messages({
            'number.base': 'LineTotal phải là số',
            'number.positive': 'LineTotal phải là số dương',
          }),
      })
    )
    .optional()
    .messages({
      'array.base': 'LineItems phải là mảng',
    }),

  amountDue: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'AmountDue phải là số',
      'number.positive': 'AmountDue phải là số dương',
    }),

  amountPaid: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .messages({
      'number.base': 'AmountPaid phải là số',
      'number.min': 'AmountPaid không được âm',
    }),

  payments: Joi.array()
    .items(
      Joi.object({
        paidAt: Joi.date()
          .iso()
          .messages({
            'date.format': 'PaidAt phải có định dạng ISO 8601',
          }),
        amount: Joi.number()
          .positive()
          .precision(2)
          .messages({
            'number.base': 'Amount phải là số',
            'number.positive': 'Amount phải là số dương',
          }),
        method: Joi.string()
          .valid('CASH', 'BANK', 'MOMO', 'OTHER')
          .messages({
            'any.only': 'Method phải là CASH, BANK, MOMO hoặc OTHER',
          }),
        note: Joi.string()
          .max(200)
          .optional()
          .messages({
            'string.max': 'Note không được vượt quá 200 ký tự',
          }),
      })
    )
    .optional()
    .messages({
      'array.base': 'Payments phải là mảng',
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
export const billParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});