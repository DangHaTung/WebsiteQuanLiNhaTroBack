import express from 'express';
import { globalSearch } from '../controllers/search.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, globalSearch);

export default router;