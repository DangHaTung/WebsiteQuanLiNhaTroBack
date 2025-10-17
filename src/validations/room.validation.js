import Joi from 'joi';

// Schema cho tạo room mới
export const createRoomSchema = Joi.object({
  roomNumber: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(50)
    .messages({
      'string.empty': 'RoomNumber không được để trống',
      'string.min': 'RoomNumber phải có ít nhất 1 ký tự',
      'string.max': 'RoomNumber không được vượt quá 50 ký tự',
      'any.required': 'RoomNumber là bắt buộc',
    }),

  type: Joi.string()
    .valid('SINGLE', 'DOUBLE', 'DORM')
    .default('SINGLE')
    .messages({
      'any.only': 'Type phải là SINGLE, DOUBLE hoặc DORM',
    }),

  pricePerMonth: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'PricePerMonth phải là số',
      'number.positive': 'PricePerMonth phải là số dương',
      'any.required': 'PricePerMonth là bắt buộc',
    }),

  areaM2: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'AreaM2 phải là số',
      'number.positive': 'AreaM2 phải là số dương',
    }),

  floor: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'number.base': 'Floor phải là số',
      'number.integer': 'Floor phải là số nguyên',
      'number.min': 'Floor phải lớn hơn hoặc bằng 1',
      'number.max': 'Floor không được vượt quá 50',
    }),

  district: Joi.string()
    .trim()
    .max(100)
    .optional()
    .messages({
      'string.max': 'District không được vượt quá 100 ký tự',
    }),

  status: Joi.string()
    .valid('AVAILABLE', 'OCCUPIED', 'MAINTENANCE')
    .default('AVAILABLE')
    .messages({
      'any.only': 'Status phải là AVAILABLE, OCCUPIED hoặc MAINTENANCE',
    }),

  // Cho phép truyền URL ảnh trong JSON
  images: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().uri().messages({ 'string.uri': 'Image URL không hợp lệ' }),
        Joi.object({
          url: Joi.string().uri().required().messages({ 'string.uri': 'Image URL không hợp lệ', 'any.required': 'url là bắt buộc' }),
          publicId: Joi.string().optional(),
        })
      )
    )
    .optional()
    .messages({ 'array.base': 'Images phải là mảng' }),

  currentContractSummary: Joi.object({
    contractId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'ContractId phải là ObjectId hợp lệ',
      }),
    tenantName: Joi.string()
      .trim()
      .max(100)
      .optional()
      .messages({
        'string.max': 'TenantName không được vượt quá 100 ký tự',
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
    monthlyRent: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.base': 'MonthlyRent phải là số',
        'number.positive': 'MonthlyRent phải là số dương',
      }),
  })
    .optional()
    .messages({
      'object.base': 'CurrentContractSummary phải là object',
    }),
});

// Schema cho cập nhật room
export const updateRoomSchema = Joi.object({
  roomNumber: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.empty': 'RoomNumber không được để trống',
      'string.min': 'RoomNumber phải có ít nhất 1 ký tự',
      'string.max': 'RoomNumber không được vượt quá 50 ký tự',
    }),

  type: Joi.string()
    .valid('SINGLE', 'DOUBLE', 'DORM')
    .optional()
    .messages({
      'any.only': 'Type phải là SINGLE, DOUBLE hoặc DORM',
    }),

  pricePerMonth: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'PricePerMonth phải là số',
      'number.positive': 'PricePerMonth phải là số dương',
    }),

  areaM2: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .messages({
      'number.base': 'AreaM2 phải là số',
      'number.positive': 'AreaM2 phải là số dương',
    }),

  floor: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'number.base': 'Floor phải là số',
      'number.integer': 'Floor phải là số nguyên',
      'number.min': 'Floor phải lớn hơn hoặc bằng 1',
      'number.max': 'Floor không được vượt quá 50',
    }),

  district: Joi.string()
    .trim()
    .max(100)
    .optional()
    .messages({
      'string.max': 'District không được vượt quá 100 ký tự',
    }),

  status: Joi.string()
    .valid('AVAILABLE', 'OCCUPIED', 'MAINTENANCE')
    .optional()
    .messages({
      'any.only': 'Status phải là AVAILABLE, OCCUPIED hoặc MAINTENANCE',
    }),

  images: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().uri().messages({ 'string.uri': 'Image URL không hợp lệ' }),
        Joi.object({
          url: Joi.string().uri().required().messages({ 'string.uri': 'Image URL không hợp lệ', 'any.required': 'url là bắt buộc' }),
          publicId: Joi.string().optional(),
        })
      )
    )
    .optional()
    .messages({ 'array.base': 'Images phải là mảng' }),

  currentContractSummary: Joi.object({
    contractId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'ContractId phải là ObjectId hợp lệ',
      }),
    tenantName: Joi.string()
      .trim()
      .max(100)
      .optional()
      .messages({
        'string.max': 'TenantName không được vượt quá 100 ký tự',
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
    monthlyRent: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.base': 'MonthlyRent phải là số',
        'number.positive': 'MonthlyRent phải là số dương',
      }),
  })
    .optional()
    .messages({
      'object.base': 'CurrentContractSummary phải là object',
    }),
})
  .min(1)
  .messages({
    'object.min': 'Phải cung cấp ít nhất một trường để cập nhật',
  });

// Schema cho params
export const roomParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});

// Params cho hình ảnh phòng
export const roomImageParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
  publicId: Joi.string()
    .min(3)
    .required()
    .messages({
      'string.min': 'publicId không hợp lệ',
      'any.required': 'publicId là bắt buộc',
    }),
});

export const setCoverBodySchema = Joi.object({
  publicId: Joi.string()
    .min(3)
    .required()
    .messages({
      'string.min': 'publicId không hợp lệ',
      'any.required': 'publicId là bắt buộc',
    }),
});

// Schema cho query parameters
export const roomQuerySchema = Joi.object({
  status: Joi.string()
    .valid('AVAILABLE', 'OCCUPIED', 'MAINTENANCE')
    .optional()
    .messages({
      'any.only': 'Status phải là AVAILABLE, OCCUPIED hoặc MAINTENANCE',
    }),

  type: Joi.string()
    .valid('SINGLE', 'DOUBLE', 'DORM')
    .optional()
    .messages({
      'any.only': 'Type phải là SINGLE, DOUBLE hoặc DORM',
    }),

  q: Joi.string()
    .trim()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Query không được vượt quá 100 ký tự',
    }),
});