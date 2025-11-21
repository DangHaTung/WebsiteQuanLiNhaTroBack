import express from "express";
import { 
  generatePaymentLink, 
  verifyTokenAndGetBill, 
  createPublicPayment 
} from "../controllers/publicPayment.controller.js";

const router = express.Router();

// Public routes - no auth required
router.get("/payment/:billId/:token", verifyTokenAndGetBill);
router.post("/payment/:billId/:token/create", createPublicPayment);

export default router;
