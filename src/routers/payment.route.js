// src/routers/payment.routes.js
import express from "express";
import paymentController from "../controllers/payment.controller.js";
import zaloController from "../controllers/paymentZalo.controller.js";

const router = express.Router();

// Tạo payment (frontend gọi để lấy url redirect)
router.post("/create", paymentController.createPayment);
router.post("/zalopay/create", zaloController.createZaloOrder);

// VNPay returns (user redirect)
router.get("/vnpay/return", paymentController.vnpayReturn);
router.post("/zalopay/callback", zaloController.zaloCallback);

// VNPay IPN (server-to-server). VNPay gửi form-urlencoded body
router.post(
  "/vnpay/ipn",
  express.urlencoded({ extended: false }),
  paymentController.vnpayIPN
);
router.post("/zalopay/query", zaloController.queryZaloOrder);

// Kiểm tra trạng thái Payment trong database
router.get("/zalopay/status", zaloController.checkPaymentStatus);

export default router;
