import Joi from 'joi';

export const createFinalContractSchema = Joi.object({
  contractId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'contractId phải là ObjectId hợp lệ',
      'any.required': 'contractId là bắt buộc',
    }),
  terms: Joi.string().trim().max(10000).optional(),
});

export const finalContractParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
});

export const viewFileParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
  index: Joi.number().integer().min(0).required().messages({
    'number.base': 'index phải là số',
    'number.min': 'index không hợp lệ',
    'any.required': 'index là bắt buộc',
  }),
});