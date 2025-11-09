import express from "express";
import Joi from 'joi';
import {
    getAllUtils,
    getUtilById,
    createUtil,
    updateUtil,
    deleteUtil,
    getUtilsByRoom,
    getBrokenUtils,
    updateUtilCondition,
} from "../controllers/util.controller.js";
import { 
    createUtilSchema, 
    updateUtilSchema, 
    utilParamsSchema,
    utilQuerySchema,
} from "../validations/util.validation.js";
import { 
    validateBody, 
    validateParams, 
    validateQuery 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN/STAFF =====
// Lấy danh sách utilities (có phân trang, filter)
router.get("/utils", authenticateToken, authorize('ADMIN', 'STAFF'), validateQuery(utilQuerySchema), asyncHandler(getAllUtils));

// Lấy utility theo ID
router.get("/utils/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(utilParamsSchema), asyncHandler(getUtilById));

// Tạo utility mới
router.post("/utils", authenticateToken, authorize('ADMIN', 'STAFF'), validateBody(createUtilSchema), asyncHandler(createUtil));

// Cập nhật utility
router.put("/utils/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(utilParamsSchema), validateBody(updateUtilSchema), asyncHandler(updateUtil));

// Xóa utility (soft delete)
router.delete("/utils/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(utilParamsSchema), asyncHandler(deleteUtil));

// Lấy utilities theo room
router.get("/rooms/:roomId/utils", authenticateToken, authorize('ADMIN', 'STAFF'), asyncHandler(getUtilsByRoom));

// Lấy danh sách utilities bị hỏng
router.get("/utils/broken", authenticateToken, authorize('ADMIN', 'STAFF'), validateQuery(utilQuerySchema), asyncHandler(getBrokenUtils));

// Cập nhật condition của utility
router.patch("/utils/:id/condition", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(utilParamsSchema), validateBody(
    Joi.object({
        condition: Joi.string().valid('new', 'used', 'broken').required(),
        notes: Joi.string().trim().max(1000).optional(),
    })
), asyncHandler(updateUtilCondition));

export default router;