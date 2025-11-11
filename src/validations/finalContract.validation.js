import Joi from 'joi';

export const createFinalContractSchema = Joi.object({
  contractId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'contractId phải là ObjectId hợp lệ',
      'any.required': 'contractId là bắt buộc',
    }),
  tenantId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'tenantId phải là ObjectId hợp lệ',
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

export const assignTenantSchema = Joi.object({
  tenantId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'tenantId phải là ObjectId hợp lệ',
      'any.required': 'tenantId là bắt buộc',
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

export const deleteFileParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID phải là ObjectId hợp lệ',
      'any.required': 'ID là bắt buộc',
    }),
  type: Joi.string().valid('images', 'cccdFiles').required().messages({
    'any.only': 'type phải là một trong: images, cccdFiles',
    'any.required': 'type là bắt buộc',
  }),
  index: Joi.number().integer().min(0).required().messages({
    'number.base': 'index phải là số',
    'number.min': 'index không hợp lệ',
    'any.required': 'index là bắt buộc',
  }),
});