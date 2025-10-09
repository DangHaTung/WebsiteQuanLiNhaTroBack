import express from "express";
import {
getAllTenants,
createTenant,
updateTenant,
deleteTenant,
} from "../controllers/tenant.controller.js";

const router = express.Router();

router.get("/tennant", getAllTenants);
router.post("/tennant", createTenant);
router.put("/tennant/:id", updateTenant);
router.delete("/tennant/:id", deleteTenant);

export default router;
    