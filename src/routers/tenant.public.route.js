import express from "express";
import { createTenant, getAllTenants, getTenantById } from "../controllers/tenant.controller.js";
import { validateBody, validateParams } from "../middleware/validation.middleware.js";
import { createTenantSchema, tenantParamsSchema } from "../validations/tenant.validation.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Route cho client tạo tenant khi đặt phòng (không cần auth)
router.post("/tennant", validateBody(createTenantSchema), asyncHandler(createTenant));

// Route cho client xem tenant của mình (cần auth nhưng không cần admin)
router.get("/tennant/my-tenant", authenticateToken, asyncHandler(getAllTenants));

// Route cho client xem tenant theo ID (cần auth nhưng không cần admin)
router.get("/tennant/public/:id", authenticateToken, validateParams(tenantParamsSchema), asyncHandler(getTenantById));

export default router;

