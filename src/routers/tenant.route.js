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

// Tất cả route đều cần xác thực
router.use(authenticateToken);

// Chỉ ADMIN và STAFF mới có thể quản lý tenants
router.use(authorize('ADMIN', 'STAFF'));

router.get("/tennant", validatePagination(), asyncHandler(getAllTenants));
router.get("/tennant/:id", validateParams(tenantParamsSchema), asyncHandler(getTenantById));
router.post("/tennant", validateBody(createTenantSchema), asyncHandler(createTenant));
router.put("/tennant/:id", validateParams(tenantParamsSchema), validateBody(updateTenantSchema), asyncHandler(updateTenant));
router.delete("/tennant/:id", validateParams(tenantParamsSchema), asyncHandler(deleteTenant));

export default router;
    