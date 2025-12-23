import Joi from 'joi';

// Middleware validation chung
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : 
                 source === 'query' ? req.query : 
                 source === 'params' ? req.params : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false, // Trả về tất cả lỗi
      stripUnknown: true, // Loại bỏ các field không có trong schema
      allowUnknown: true, // Cho phép field không xác định (như refundQrCode từ multer)
    });

    if (error) {
      console.log('[validation.middleware] Validation error:', error.details);
      console.log('[validation.middleware] Data being validated:', data);
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errorMessages,
      });
    }

    // Gán dữ liệu đã validate vào request
    if (source === 'body') {
      req.body = value;
    } else if (source === 'query') {
      // Express 5: req.query là getter, không được gán lại
      // Xoá keys cũ và merge giá trị đã validate
      Object.keys(req.query || {}).forEach((k) => delete req.query[k]);
      Object.assign(req.query, value);
    } else if (source === 'params') {
      // Tránh gán lại toàn bộ object
      Object.keys(req.params || {}).forEach((k) => delete req.params[k]);
      Object.assign(req.params, value);
    }

    next();
  };
};

// Middleware validation cho body
export const validateBody = (schema) => validate(schema, 'body');

// Middleware validation cho query
export const validateQuery = (schema) => validate(schema, 'query');

// Middleware validation cho params
export const validateParams = (schema) => validate(schema, 'params');

// Middleware validation cho ObjectId
export const validateObjectId = (paramName = 'id') => {
  const schema = Joi.object({
    [paramName]: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': `${paramName} phải là ObjectId hợp lệ`,
        'any.required': `${paramName} là bắt buộc`,
      }),
  });

  return validateParams(schema);
};

// Middleware validation cho pagination
export const validatePagination = () => {
  const schema = Joi.object({
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
  });

  return validateQuery(schema);
};

// Middleware validation cho date range
export const validateDateRange = () => {
  const schema = Joi.object({
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
  });

  return validateQuery(schema);
};