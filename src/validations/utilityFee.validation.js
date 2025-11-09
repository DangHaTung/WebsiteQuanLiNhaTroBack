import Joi from 'joi';

const FEE_TYPES = [
  "electricity",
  "water",
  "internet",
  "cleaning",
  "parking",
];

const tierSchema = Joi.object({
  min: Joi.number().integer().min(0).required(),
  max: Joi.number().integer().min(Joi.ref('min')).optional(),
  rate: Joi.number().integer().min(0).required(),
});

export const createFeeSchema = Joi.object({
  type: Joi.string().valid(...FEE_TYPES).required(),
  description: Joi.string().trim().max(500).optional(),
  baseRate: Joi.number().min(0).optional(),
  electricityTiers: Joi.array().items(tierSchema).optional(),
  vatPercent: Joi.number().min(0).max(100).default(8),
  isActive: Joi.boolean().default(true),
});

export const updateFeeSchema = Joi.object({
  type: Joi.string().valid(...FEE_TYPES).optional(),
  description: Joi.string().trim().max(500).optional(),
  baseRate: Joi.number().min(0).optional(),
  electricityTiers: Joi.array().items(tierSchema).optional(),
  vatPercent: Joi.number().min(0).max(100).optional(),
  isActive: Joi.boolean().optional(),
});

export const feeParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});

export const feeQuerySchema = Joi.object({
  type: Joi.string().valid(...FEE_TYPES).optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export const electricityCalcSchema = Joi.object({
  kwh: Joi.number().min(0).required(),
});