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

const router = express.Router();

// Middleware validation
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: 'Dữ liệu không hợp lệ',
      error: error.details[0].message 
    });
  }
  next();
};

// Middleware validation cho query params
const validateQuery = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({ 
      message: 'Tham số truy vấn không hợp lệ',
      error: error.details[0].message 
    });
  }
  next();
};

// Middleware validation cho params
const validateParams = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.params);
  if (error) {
    return res.status(400).json({ 
      message: 'Tham số đường dẫn không hợp lệ',
      error: error.details[0].message 
    });
  }
  next();
};

// Routes cho Log CRUD
router.post('/logs', validate(createLogSchema), createLog);
router.get('/logs', validateQuery(getLogsSchema), getLogs);
router.get('/logs/stats', validateQuery(getLogStatsSchema), getLogStats);
router.get('/logs/cleanup', cleanupOldLogs);

// Routes cho Log theo ID
router.get('/logs/:id', getLogById);
router.put('/logs/:id', validate(updateLogSchema), updateLog);
router.delete('/logs/:id', deleteLog);

// Routes cho Log theo Entity
router.get('/logs/entity/:entity/:entityId', getLogsByEntity);

export default router;
