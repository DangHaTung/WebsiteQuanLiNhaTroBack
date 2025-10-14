import express from "express";
import {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
} from "../controllers/tenant.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/security.middleware.js";
import { 
  createTenantSchema, 
  updateTenantSchema,
  paginationSchema,
  validate 
} from "../validations/index.js";

const router = express.Router();

// Protected routes (cần authentication)
router.get("/tenants", verifyToken, requireRole("ADMIN", "LANDLORD", "STAFF"), validate(paginationSchema, "query"), getAllTenants);
router.get("/tenants/:id", verifyToken, requireRole("ADMIN", "LANDLORD", "STAFF"), validateObjectId("id"), getTenantById);
router.post("/tenants", verifyToken, requireRole("ADMIN", "LANDLORD"), validate(createTenantSchema), createTenant);
router.put("/tenants/:id", verifyToken, requireRole("ADMIN", "LANDLORD"), validateObjectId("id"), validate(updateTenantSchema), updateTenant);
router.delete("/tenants/:id", verifyToken, requireRole("ADMIN"), validateObjectId("id"), deleteTenant);

export default router;
    