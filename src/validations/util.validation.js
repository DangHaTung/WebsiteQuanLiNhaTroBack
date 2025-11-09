import Joi from 'joi';

const UTILITY_TYPES = [
    "refrigerator",
    "air_conditioner", 
    "washing_machine",
    "television",
    "microwave",
    "water_heater",
    "fan",
    "bed",
    "wardrobe",
    "desk",
    "chair",
    "sofa",
    "wifi_router",
    "other"
];

const UTILITY_CONDITIONS = ["new", "used", "broken"];

// Schema cho tạo utility mới
export const createUtilSchema = Joi.object({
    name: Joi.string()
        .valid(...UTILITY_TYPES)
        .required()
        .messages({
            'any.only': `Name phải là một trong: ${UTILITY_TYPES.join(', ')}`,
            'any.required': 'Name là bắt buộc',
        }),

    condition: Joi.string()
        .valid(...UTILITY_CONDITIONS)
        .default('used')
        .messages({
            'any.only': `Condition phải là một trong: ${UTILITY_CONDITIONS.join(', ')}`,
        }),

    description: Joi.string()
        .trim()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Description không được vượt quá 500 ký tự',
        }),
    room: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Room ID phải là ObjectId hợp lệ',
        }),
});

// Schema cho cập nhật utility
export const updateUtilSchema = Joi.object({
    name: Joi.string()
        .valid(...UTILITY_TYPES)
        .optional()
        .messages({
            'any.only': `Name phải là một trong: ${UTILITY_TYPES.join(', ')}`,
        }),

    condition: Joi.string()
        .valid(...UTILITY_CONDITIONS)
        .optional()
        .messages({
            'any.only': `Condition phải là một trong: ${UTILITY_CONDITIONS.join(', ')}`,
        }),

    description: Joi.string()
        .trim()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Description không được vượt quá 500 ký tự',
        }),



    room: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Room ID phải là ObjectId hợp lệ',
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'IsActive phải là boolean',
        }),
});

// Schema cho params (ID)
export const utilParamsSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'ID phải là ObjectId hợp lệ',
            'any.required': 'ID là bắt buộc',
        }),
});

// Schema cho query parameters
export const utilQuerySchema = Joi.object({
    name: Joi.string()
        .valid(...UTILITY_TYPES)
        .optional()
        .messages({
            'any.only': `Name phải là một trong: ${UTILITY_TYPES.join(', ')}`,
        }),

    condition: Joi.string()
        .valid(...UTILITY_CONDITIONS)
        .optional()
        .messages({
            'any.only': `Condition phải là một trong: ${UTILITY_CONDITIONS.join(', ')}`,
        }),

    room: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Room ID phải là ObjectId hợp lệ',
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'IsActive phải là boolean',
        }),

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