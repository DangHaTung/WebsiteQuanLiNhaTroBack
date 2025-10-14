import Joi from "joi";

// Common validation schemas
export const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": "Invalid ID format"
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc")
});

// Room validation schemas
export const createRoomSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(20).required().messages({
    "string.empty": "Số phòng không được bỏ trống",
    "string.min": "Số phòng phải có ít nhất 1 ký tự",
    "string.max": "Số phòng không được quá 20 ký tự"
  }),
  type: Joi.string().valid("SINGLE", "DOUBLE", "TRIPLE", "FAMILY").required().messages({
    "any.only": "Loại phòng phải là SINGLE, DOUBLE, TRIPLE hoặc FAMILY"
  }),
  pricePerMonth: Joi.number().positive().required().messages({
    "number.positive": "Giá thuê phải là số dương",
    "number.base": "Giá thuê phải là số"
  }),
  areaM2: Joi.number().positive().messages({
    "number.positive": "Diện tích phải là số dương"
  }),
  floor: Joi.number().integer().min(1).max(50).messages({
    "number.integer": "Tầng phải là số nguyên",
    "number.min": "Tầng phải từ 1 trở lên",
    "number.max": "Tầng không được quá 50"
  }),
  district: Joi.string().min(2).max(100).messages({
    "string.min": "Quận/huyện phải có ít nhất 2 ký tự",
    "string.max": "Quận/huyện không được quá 100 ký tự"
  }),
  status: Joi.string().valid("AVAILABLE", "OCCUPIED", "MAINTENANCE", "RESERVED").default("AVAILABLE"),
  currentContractSummary: Joi.string().max(500).allow("")
});

export const updateRoomSchema = createRoomSchema.fork(Object.keys(createRoomSchema.describe().keys), (schema) => schema.optional());

export const roomQuerySchema = Joi.object({
  status: Joi.string().valid("AVAILABLE", "OCCUPIED", "MAINTENANCE", "RESERVED"),
  type: Joi.string().valid("SINGLE", "DOUBLE", "TRIPLE", "FAMILY"),
  q: Joi.string().max(50).messages({
    "string.max": "Từ khóa tìm kiếm không được quá 50 ký tự"
  }),
  ...paginationSchema.describe().keys
});

// Tenant validation schemas
export const createTenantSchema = Joi.object({
  fullName: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Họ tên không được bỏ trống",
    "string.min": "Họ tên phải có ít nhất 3 ký tự",
    "string.max": "Họ tên không được quá 100 ký tự"
  }),
  phone: Joi.string().pattern(/^[0-9]{9,11}$/).required().messages({
    "string.pattern.base": "Số điện thoại phải từ 9–11 chữ số",
    "string.empty": "Số điện thoại không được bỏ trống"
  }),
  email: Joi.string().email().messages({
    "string.email": "Email không hợp lệ"
  }),
  identityNo: Joi.string().pattern(/^[0-9]{9,12}$/).messages({
    "string.pattern.base": "Số CMND/CCCD phải từ 9–12 chữ số"
  }),
  note: Joi.string().max(500).allow("")
});

export const updateTenantSchema = createTenantSchema.fork(Object.keys(createTenantSchema.describe().keys), (schema) => schema.optional());

// Contract validation schemas
export const createContractSchema = Joi.object({
  tenantId: objectIdSchema.required().messages({
    "string.empty": "ID người thuê không được bỏ trống"
  }),
  roomId: objectIdSchema.required().messages({
    "string.empty": "ID phòng không được bỏ trống"
  }),
  startDate: Joi.date().min("now").required().messages({
    "date.min": "Ngày bắt đầu phải từ hôm nay trở đi",
    "date.base": "Ngày bắt đầu không hợp lệ"
  }),
  endDate: Joi.date().min(Joi.ref("startDate")).required().messages({
    "date.min": "Ngày kết thúc phải sau ngày bắt đầu",
    "date.base": "Ngày kết thúc không hợp lệ"
  }),
  monthlyRent: Joi.number().positive().required().messages({
    "number.positive": "Tiền thuê hàng tháng phải là số dương",
    "number.base": "Tiền thuê hàng tháng phải là số"
  }),
  deposit: Joi.number().min(0).messages({
    "number.min": "Tiền cọc không được âm"
  }),
  status: Joi.string().valid("ACTIVE", "EXPIRED", "TERMINATED", "PENDING").default("PENDING"),
  terms: Joi.string().max(1000).allow(""),
  notes: Joi.string().max(500).allow("")
});

export const updateContractSchema = createContractSchema.fork(Object.keys(createContractSchema.describe().keys), (schema) => schema.optional());

export const contractQuerySchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "EXPIRED", "TERMINATED", "PENDING"),
  tenantId: objectIdSchema,
  roomId: objectIdSchema,
  ...paginationSchema.describe().keys
});

// Bill validation schemas
export const createBillSchema = Joi.object({
  contractId: objectIdSchema.required().messages({
    "string.empty": "ID hợp đồng không được bỏ trống"
  }),
  month: Joi.number().integer().min(1).max(12).required().messages({
    "number.integer": "Tháng phải là số nguyên",
    "number.min": "Tháng phải từ 1-12",
    "number.max": "Tháng phải từ 1-12"
  }),
  year: Joi.number().integer().min(2020).max(2030).required().messages({
    "number.integer": "Năm phải là số nguyên",
    "number.min": "Năm phải từ 2020 trở lên",
    "number.max": "Năm không được quá 2030"
  }),
  rentAmount: Joi.number().positive().required().messages({
    "number.positive": "Tiền thuê phải là số dương",
    "number.base": "Tiền thuê phải là số"
  }),
  utilitiesAmount: Joi.number().min(0).default(0).messages({
    "number.min": "Tiền điện nước không được âm"
  }),
  otherFees: Joi.number().min(0).default(0).messages({
    "number.min": "Phí khác không được âm"
  }),
  totalAmount: Joi.number().positive().required().messages({
    "number.positive": "Tổng tiền phải là số dương",
    "number.base": "Tổng tiền phải là số"
  }),
  dueDate: Joi.date().min("now").required().messages({
    "date.min": "Ngày đến hạn phải từ hôm nay trở đi",
    "date.base": "Ngày đến hạn không hợp lệ"
  }),
  status: Joi.string().valid("PENDING", "PAID", "OVERDUE", "CANCELLED").default("PENDING"),
  notes: Joi.string().max(500).allow("")
});

export const updateBillSchema = createBillSchema.fork(Object.keys(createBillSchema.describe().keys), (schema) => schema.optional());

export const billQuerySchema = Joi.object({
  status: Joi.string().valid("PENDING", "PAID", "OVERDUE", "CANCELLED"),
  contractId: objectIdSchema,
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2020).max(2030),
  ...paginationSchema.describe().keys
});

// Validation middleware
export const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join("."),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }
    
    next();
  };
};
