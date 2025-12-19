import express from "express";
import { 
  generatePaymentLink, 
  verifyTokenAndGetBill, 
  createPublicPayment,
  uploadReceiptForCashPayment
} from "../controllers/publicPayment.controller.js";
import { uploadReceiptImage } from "../middleware/upload.middleware.js";

const router = express.Router();

// Public routes - no auth required
router.get("/payment/:billId/:token", verifyTokenAndGetBill);
router.post("/payment/:billId/:token/create", createPublicPayment);
// Upload receipt image for cash payment (public, uses paymentToken)
router.post("/payment/:billId/:token/upload-receipt", uploadReceiptImage, uploadReceiptForCashPayment);

export default router;
