import Joi from 'joi';

export const assignRoomFeesSchema = Joi.object({
  appliedTypes: Joi.array()
    .items(Joi.string().valid('electricity', 'water', 'internet', 'cleaning', 'parking'))
    .min(1)
    .required(),
});

export const roomParamsSchema = Joi.object({
  roomId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
});

// Schema cho thông tin xe
const vehicleSchema = Joi.object({
  type: Joi.string().valid('motorbike', 'electric_bike', 'bicycle').required(),
  licensePlate: Joi.string().allow('', null).optional(),
});

export const calculateRoomFeesSchema = Joi.object({
  kwh: Joi.number().min(0).default(0),
  occupantCount: Joi.number().integer().min(0).default(0),
  vehicleCount: Joi.number().integer().min(0).default(0), // Deprecated, dùng vehicles thay thế
  vehicles: Joi.array().items(vehicleSchema).default([]), // Danh sách xe chi tiết
});