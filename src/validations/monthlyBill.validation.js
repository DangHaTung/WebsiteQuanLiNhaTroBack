// Validation schemas cho monthly bill
import Joi from "joi";

// Schema cho việc tạo hóa đơn đơn lẻ
export const createSingleBillSchema = Joi.object({
  contractId: Joi.string().required().messages({
    "string.empty": "contractId là bắt buộc",
    "any.required": "contractId là bắt buộc",
  }),
  electricityKwh: Joi.number().min(0).default(0).messages({
    "number.base": "electricityKwh phải là số",
    "number.min": "electricityKwh không được âm",
  }),
  waterM3: Joi.number().min(0).default(0).messages({
    "number.base": "waterM3 phải là số",
    "number.min": "waterM3 không được âm",
  }),
  occupantCount: Joi.number().integer().min(0).default(1).messages({
    "number.base": "occupantCount phải là số",
    "number.integer": "occupantCount phải là số nguyên",
    "number.min": "occupantCount không được âm",
  }),
  billingDate: Joi.date().optional().messages({
    "date.base": "billingDate phải là ngày hợp lệ",
  }),
  note: Joi.string().max(500).optional().messages({
    "string.max": "note không được vượt quá 500 ký tự",
  }),
});

// Schema cho việc tạo hóa đơn hàng loạt
export const createBatchBillsSchema = Joi.object({
  billingDate: Joi.date().optional().messages({
    "date.base": "billingDate phải là ngày hợp lệ",
  }),
  roomUsageData: Joi.object().pattern(
    Joi.string(), // roomId
    Joi.object({
      electricityKwh: Joi.number().min(0).default(0),
      waterM3: Joi.number().min(0).default(0),
      occupantCount: Joi.number().integer().min(0).default(1),
    })
  ).optional().messages({
    "object.base": "roomUsageData phải là object",
  }),
});

// Schema cho auto generate
export const autoGenerateBillsSchema = Joi.object({
  billingDate: Joi.date().optional().messages({
    "date.base": "billingDate phải là ngày hợp lệ",
  }),
});

// Schema cho preview
export const previewBillQuerySchema = Joi.object({
  electricityKwh: Joi.number().min(0).default(0),
  waterM3: Joi.number().min(0).default(0),
  occupantCount: Joi.number().integer().min(0).default(1),
});

// Schema cho contractId params
export const contractParamsSchema = Joi.object({
  contractId: Joi.string().required().messages({
    "string.empty": "contractId là bắt buộc",
    "any.required": "contractId là bắt buộc",
  }),
});
