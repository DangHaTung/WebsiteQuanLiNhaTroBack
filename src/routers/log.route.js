import express from 'express';
import {
  createLog,
  getLogs,
  getLogById,
  updateLog,
  deleteLog,
  getLogStats,
  getLogsByEntity,
  cleanupOldLogs,
} from '../controllers/log.controller.js';
import { 
  createLogSchema, 
  updateLogSchema,
  getLogsSchema,
  getLogStatsSchema 
} from '../validations/log.validation.js';
import { 
  validateBody, 
  validateQuery, 
  validateParams 
} from '../middleware/validation.middleware.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = express.Router();

// Tất cả route đều cần xác thực
router.use(authenticateToken);

// Chỉ ADMIN mới có thể quản lý logs
router.use(authorize('ADMIN'));

// Routes cho Log CRUD
router.post('/logs', validateBody(createLogSchema), asyncHandler(createLog));
router.get('/logs', validateQuery(getLogsSchema), asyncHandler(getLogs));
router.get('/logs/stats', validateQuery(getLogStatsSchema), asyncHandler(getLogStats));
router.get('/logs/cleanup', asyncHandler(cleanupOldLogs));

// Routes cho Log theo ID
router.get('/logs/:id', asyncHandler(getLogById));
router.put('/logs/:id', validateBody(updateLogSchema), asyncHandler(updateLog));
router.delete('/logs/:id', asyncHandler(deleteLog));

// Routes cho Log theo Entity
router.get('/logs/entity/:entity/:entityId', asyncHandler(getLogsByEntity));

export default router;
