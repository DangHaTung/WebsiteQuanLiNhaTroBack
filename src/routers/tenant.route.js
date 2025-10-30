import express from "express";
import {
getAllTenants,
getTenantById,
createTenant,
updateTenant,
deleteTenant,
} from "../controllers/tenant.controller.js";
import { 
  createTenantSchema, 
  updateTenantSchema, 
  tenantParamsSchema 
} from "../validations/tenant.validation.js";
import { 
  validateBody, 
  validateParams, 
  validatePagination 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN/STAFF =====
// Public routes đã được tách ra file riêng: tenant.public.route.js
router.get("/tennant", authenticateToken, authorize('ADMIN', 'STAFF'), validatePagination(), asyncHandler(getAllTenants));
router.get("/tennant/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(tenantParamsSchema), asyncHandler(getTenantById));
router.put("/tennant/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(tenantParamsSchema), validateBody(updateTenantSchema), asyncHandler(updateTenant));
router.delete("/tennant/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(tenantParamsSchema), asyncHandler(deleteTenant));

export default router;
    