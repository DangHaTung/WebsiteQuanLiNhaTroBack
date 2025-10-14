import express from "express";
import {
  getAllContracts,
  createContract,
  getContractById,
  updateContract,
  deleteContract,
} from "../controllers/contract.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/security.middleware.js";
import { 
  createContractSchema, 
  updateContractSchema,
  contractQuerySchema,
  validate 
} from "../validations/index.js";

const router = express.Router();

// Protected routes (cần authentication)
router.get("/contracts", verifyToken, requireRole("ADMIN", "LANDLORD", "STAFF"), validate(contractQuerySchema, "query"), getAllContracts);
router.get("/contracts/:id", verifyToken, requireRole("ADMIN", "LANDLORD", "STAFF", "TENANT"), validateObjectId("id"), getContractById);
router.post("/contracts", verifyToken, requireRole("ADMIN", "LANDLORD"), validate(createContractSchema), createContract);
router.put("/contracts/:id", verifyToken, requireRole("ADMIN", "LANDLORD"), validateObjectId("id"), validate(updateContractSchema), updateContract);
router.delete("/contracts/:id", verifyToken, requireRole("ADMIN"), validateObjectId("id"), deleteContract);

export default router;
