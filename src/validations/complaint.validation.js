import Joi from "joi";

export const createComplaintSchema = Joi.object({
  tenantId: Joi.string().hex().length(24).required().messages({
    "string.empty": "ID tenant không được bỏ trống",
    "string.hex": "ID tenant phải là chuỗi hex hợp lệ",
    "string.length": "ID tenant phải có đúng 24 ký tự",
  }),

  title: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Tiêu đề không được bỏ trống",
    "string.min": "Tiêu đề phải có ít nhất 3 ký tự",
    "string.max": "Tiêu đề không được vượt quá 200 ký tự",
  }),

  description: Joi.string().trim().min(10).max(1000).required().messages({
    "string.empty": "Mô tả complaint không được bỏ trống",
    "string.min": "Mô tả complaint phải có ít nhất 10 ký tự",
    "string.max": "Mô tả complaint không được vượt quá 1000 ký tự",
  }),

  adminNote: Joi.string().max(500).optional().messages({
    "string.max": "Ghi chú admin không được vượt quá 500 ký tự",
  }),
});

export const updateComplaintStatusSchema = Joi.object({
  status: Joi.string()
    .valid("PENDING", "IN_PROGRESS", "RESOLVED")
    .required()
    .messages({
      "string.empty": "Trạng thái không được bỏ trống",
      "any.only": "Trạng thái phải là PENDING, IN_PROGRESS hoặc RESOLVED",
    }),

  adminNote: Joi.string().max(500).optional().messages({
    "string.max": "Ghi chú admin không được vượt quá 500 ký tự",
  }),
});

export const complaintIdSchema = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    "string.empty": "ID complaint không được bỏ trống",
    "string.hex": "ID complaint phải là chuỗi hex hợp lệ",
    "string.length": "ID complaint phải có đúng 24 ký tự",
  }),
});

export const tenantIdSchema = Joi.object({
  tenantId: Joi.string().hex().length(24).required().messages({
    "string.empty": "ID tenant không được bỏ trống",
    "string.hex": "ID tenant phải là chuỗi hex hợp lệ",
    "string.length": "ID tenant phải có đúng 24 ký tự",
  }),
});
