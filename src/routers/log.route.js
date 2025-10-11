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
router.post('/', validate(createLogSchema), createLog);
router.get('/', validateQuery(getLogsSchema), getLogs);
router.get('/stats', validateQuery(getLogStatsSchema), getLogStats);
router.get('/cleanup', cleanupOldLogs);

// Routes cho Log theo ID
router.get('/:id', getLogById);
router.put('/:id', validate(updateLogSchema), updateLog);
router.delete('/:id', deleteLog);

// Routes cho Log theo Entity
router.get('/entity/:entity/:entityId', getLogsByEntity);

export default router;
