// src/routers/payment.routes.js
import express from "express";
import paymentController from "../controllers/payment.controller.js";

const router = express.Router();

// Tạo payment (frontend gọi để lấy url redirect)
router.post("/create", paymentController.createPayment);         

// VNPay returns (user redirect)
router.get("/vnpay/return", paymentController.vnpayReturn);

// VNPay IPN (server-to-server). VNPay gửi form-urlencoded body
router.post("/vnpay/ipn", express.urlencoded({ extended: false }), paymentController.vnpayIPN);

export default router;
