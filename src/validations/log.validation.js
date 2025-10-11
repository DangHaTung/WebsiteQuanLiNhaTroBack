import Joi from 'joi';

// Schema cho tạo log mới
export const createLogSchema = Joi.object({
  level: Joi.string()
    .valid('INFO', 'WARN', 'ERROR')
    .default('INFO')
    .messages({
      'any.only': 'Level phải là INFO, WARN hoặc ERROR',
    }),
  
  message: Joi.string()
    .required()
    .trim()
    .min(1)
    .max(500)
    .messages({
      'string.empty': 'Message không được để trống',
      'string.min': 'Message phải có ít nhất 1 ký tự',
      'string.max': 'Message không được vượt quá 500 ký tự',
    }),
  
  context: Joi.object({
    entity: Joi.string()
      .valid('ROOM', 'CONTRACT', 'BILL', 'USER')
      .required()
      .messages({
        'any.only': 'Entity phải là một trong các giá trị: ROOM, CONTRACT, BILL, USER',
        'any.required': 'Entity là bắt buộc',
      }),
    
    entityId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'EntityId phải là ObjectId hợp lệ',
        'any.required': 'EntityId là bắt buộc',
      }),
    
    actorId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'ActorId phải là ObjectId hợp lệ',
      }),
    
    diff: Joi.any()
      .optional()
      .messages({
        'any.base': 'Diff có thể là bất kỳ kiểu dữ liệu nào',
      }),
  })
    .required()
    .messages({
      'any.required': 'Context là bắt buộc',
    }),
  
  ipAddress: Joi.string()
    .ip()
    .optional()
    .messages({
      'string.ip': 'IP Address không hợp lệ',
    }),
  
  userAgent: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'User Agent không được vượt quá 500 ký tự',
    }),
  
  sessionId: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Session ID không được vượt quá 100 ký tự',
    }),
});

// Schema cho cập nhật log
export const updateLogSchema = Joi.object({
  level: Joi.string()
    .valid('INFO', 'WARN', 'ERROR')
    .optional()
    .messages({
      'any.only': 'Level phải là INFO, WARN hoặc ERROR',
    }),
  
  message: Joi.string()
    .trim()
    .min(1)
    .max(500)
    .optional()
    .messages({
      'string.min': 'Message phải có ít nhất 1 ký tự',
      'string.max': 'Message không được vượt quá 500 ký tự',
    }),
  
  context: Joi.object({
    entity: Joi.string()
      .valid('ROOM', 'CONTRACT', 'BILL', 'USER')
      .optional()
      .messages({
        'any.only': 'Entity phải là một trong các giá trị: ROOM, CONTRACT, BILL, USER',
      }),
    
    entityId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'EntityId phải là ObjectId hợp lệ',
      }),
    
    actorId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'ActorId phải là ObjectId hợp lệ',
      }),
    
    diff: Joi.any()
      .optional()
      .messages({
        'any.base': 'Diff có thể là bất kỳ kiểu dữ liệu nào',
      }),
  })
    .optional()
    .messages({
      'object.base': 'Context phải là object',
    }),
})
  .min(1)
  .messages({
    'object.min': 'Phải cung cấp ít nhất một trường để cập nhật',
  });

// Schema cho query parameters của getLogs
export const getLogsSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page phải là số',
      'number.integer': 'Page phải là số nguyên',
      'number.min': 'Page phải lớn hơn hoặc bằng 1',
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': 'Limit phải là số',
      'number.integer': 'Limit phải là số nguyên',
      'number.min': 'Limit phải lớn hơn hoặc bằng 1',
      'number.max': 'Limit không được vượt quá 100',
    }),
  
  level: Joi.string()
    .valid('INFO', 'WARN', 'ERROR')
    .optional()
    .messages({
      'any.only': 'Level phải là INFO, WARN hoặc ERROR',
    }),
  
  entity: Joi.string()
    .valid('ROOM', 'CONTRACT', 'BILL', 'USER')
    .optional()
    .messages({
      'any.only': 'Entity phải là một trong các giá trị: ROOM, CONTRACT, BILL, USER',
    }),
  
  actorId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'ActorId phải là ObjectId hợp lệ',
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
  
  sortBy: Joi.string()
    .valid('createdAt', 'level', 'message')
    .default('createdAt')
    .messages({
      'any.only': 'SortBy phải là createdAt, level hoặc message',
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'SortOrder phải là asc hoặc desc',
    }),
});

// Schema cho query parameters của getLogStats
export const getLogStatsSchema = Joi.object({
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
  
  groupBy: Joi.string()
    .valid('level', 'entity', 'actor')
    .default('level')
    .messages({
      'any.only': 'GroupBy phải là level, entity hoặc actor',
    }),
});

// Schema cho cleanup logs
export const cleanupLogsSchema = Joi.object({
  days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .messages({
      'number.base': 'Days phải là số',
      'number.integer': 'Days phải là số nguyên',
      'number.min': 'Days phải lớn hơn hoặc bằng 1',
      'number.max': 'Days không được vượt quá 365',
    }),
  
  level: Joi.string()
    .valid('INFO', 'WARN', 'ERROR')
    .optional()
    .messages({
      'any.only': 'Level phải là INFO, WARN hoặc ERROR',
    }),
});

// Schema cho params của getLogsByEntity
export const getLogsByEntityParamsSchema = Joi.object({
  entity: Joi.string()
    .valid('ROOM', 'CONTRACT', 'BILL', 'USER')
    .required()
    .messages({
      'any.only': 'Entity phải là một trong các giá trị: ROOM, CONTRACT, BILL, USER',
      'any.required': 'Entity là bắt buộc',
    }),
  
  entityId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'EntityId phải là ObjectId hợp lệ',
      'any.required': 'EntityId là bắt buộc',
    }),
});
