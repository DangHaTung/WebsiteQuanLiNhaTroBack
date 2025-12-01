import Joi from 'joi';

// Schema cho tạo log mới
export const createLogSchema = Joi.object({
  level: Joi.string().valid('INFO', 'WARN', 'ERROR').required().messages({
    'any.only': 'Level phải là INFO, WARN hoặc ERROR',
    'any.required': 'Level là bắt buộc',
  }),
  message: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'Message không được để trống',
    'string.max': 'Message không được vượt quá 500 ký tự',
    'any.required': 'Message là bắt buộc',
  }),
  context: Joi.object({
    entity: Joi.string().valid('ROOM', 'CONTRACT', 'BILL', 'USER', 'CHECKIN', 'FINALCONTRACT', 'PAYMENT').required().messages({
      'any.only': 'Entity không hợp lệ',
      'any.required': 'Entity là bắt buộc',
    }),
    entityId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'EntityId phải là ObjectId hợp lệ',
      'any.required': 'EntityId là bắt buộc',
    }),
    actorId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null).messages({
      'string.pattern.base': 'ActorId phải là ObjectId hợp lệ',
    }),
    diff: Joi.any().optional().allow(null),
    entityRef: Joi.string().required().messages({
      'any.required': 'EntityRef là bắt buộc',
    }),
  }).required(),
});

// Schema cho cập nhật log
export const updateLogSchema = Joi.object({
  level: Joi.string().valid('INFO', 'WARN', 'ERROR').optional().messages({
    'any.only': 'Level phải là INFO, WARN hoặc ERROR',
  }),
  message: Joi.string().trim().min(1).max(500).optional().messages({
    'string.empty': 'Message không được để trống',
    'string.max': 'Message không được vượt quá 500 ký tự',
  }),
  context: Joi.object({
    entity: Joi.string().valid('ROOM', 'CONTRACT', 'BILL', 'USER', 'CHECKIN', 'FINALCONTRACT', 'PAYMENT').optional(),
    entityId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    actorId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
    diff: Joi.any().optional().allow(null),
    entityRef: Joi.string().optional(),
  }).optional(),
}).min(1).messages({
  'object.min': 'Phải cung cấp ít nhất một trường để cập nhật',
});

// Schema cho query params khi lấy danh sách logs
export const getLogsSchema = Joi.object({
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
  level: Joi.string().valid('INFO', 'WARN', 'ERROR').optional().messages({
    'any.only': 'Level phải là INFO, WARN hoặc ERROR',
  }),
  entity: Joi.string().valid('ROOM', 'CONTRACT', 'BILL', 'USER', 'CHECKIN', 'FINALCONTRACT', 'PAYMENT').optional().messages({
    'any.only': 'Entity không hợp lệ',
  }),
  actorId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().messages({
    'string.pattern.base': 'ActorId phải là ObjectId hợp lệ',
  }),
  startDate: Joi.date().iso().optional().messages({
    'date.format': 'StartDate phải là ngày hợp lệ (ISO format)',
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
    'date.format': 'EndDate phải là ngày hợp lệ (ISO format)',
    'date.min': 'EndDate phải sau StartDate',
  }),
  sortBy: Joi.string().valid('createdAt', 'level').default('createdAt').messages({
    'any.only': 'SortBy phải là createdAt hoặc level',
  }),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
    'any.only': 'SortOrder phải là asc hoặc desc',
  }),
});

// Schema cho thống kê logs
export const getLogStatsSchema = Joi.object({
  startDate: Joi.date().iso().optional().messages({
    'date.format': 'StartDate phải là ngày hợp lệ (ISO format)',
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
    'date.format': 'EndDate phải là ngày hợp lệ (ISO format)',
    'date.min': 'EndDate phải sau StartDate',
  }),
  groupBy: Joi.string().valid('level', 'entity', 'actor').default('level').messages({
    'any.only': 'GroupBy phải là level, entity hoặc actor',
  }),
});

// Schema cho params (ID)
export const logParamsSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID phải là ObjectId hợp lệ',
    'any.required': 'ID là bắt buộc',
  }),
});

// Schema cho entity logs params
export const entityLogsParamsSchema = Joi.object({
  entity: Joi.string().valid('ROOM', 'CONTRACT', 'BILL', 'USER', 'CHECKIN', 'FINALCONTRACT', 'PAYMENT').required().messages({
    'any.only': 'Entity không hợp lệ',
    'any.required': 'Entity là bắt buộc',
  }),
  entityId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'EntityId phải là ObjectId hợp lệ',
    'any.required': 'EntityId là bắt buộc',
  }),
});

// Schema cho cleanup query
export const cleanupLogsSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30).messages({
    'number.base': 'Days phải là số',
    'number.integer': 'Days phải là số nguyên',
    'number.min': 'Days phải lớn hơn hoặc bằng 1',
    'number.max': 'Days không được vượt quá 365',
  }),
  level: Joi.string().valid('INFO', 'WARN', 'ERROR').optional().messages({
    'any.only': 'Level phải là INFO, WARN hoặc ERROR',
  }),
});
