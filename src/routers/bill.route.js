import express from "express";
import { getAllBills, getBillById, createBill, updateBill, deleteBill } from "../controllers/bill.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/security.middleware.js";
import { 
  createBillSchema, 
  updateBillSchema,
  billQuerySchema,
  validate 
} from "../validations/index.js";

const router = express.Router();

// Protected routes (cần authentication)
router.get("/bills", verifyToken, requireRole("ADMIN", "LANDLORD", "STAFF"), validate(billQuerySchema, "query"), getAllBills);
router.get("/bills/:id", verifyToken, requireRole("ADMIN", "LANDLORD", "STAFF"), validateObjectId("id"), getBillById);
router.post("/bills", verifyToken, requireRole("ADMIN", "LANDLORD"), validate(createBillSchema), createBill);
router.put("/bills/:id", verifyToken, requireRole("ADMIN", "LANDLORD"), validateObjectId("id"), validate(updateBillSchema), updateBill);
router.delete("/bills/:id", verifyToken, requireRole("ADMIN"), validateObjectId("id"), deleteBill);

export default router;
