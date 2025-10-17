// src/routers/payment.route.js
import express from "express";
import paymentController from "../controllers/payment.controller.js";
import momoController from "../controllers/momo.controller.js";
import { authenticateToken as authMiddleware } from "../middleware/auth.middleware.js";

const securedRouter = express.Router();
const publicRouter = express.Router();

/* ---------- ROUTES CẦN ĐĂNG NHẬP ---------- */
securedRouter.post("/vnpay/create", paymentController.createPayment);
securedRouter.post("/momo/create", authMiddleware, momoController.createPayment);

/* ---------- ROUTES PUBLIC ---------- */
// VNPay public
publicRouter.get("/vnpay/return", paymentController.vnpayReturn);
publicRouter.post("/vnpay/ipn", express.urlencoded({ extended: false }), paymentController.vnpayIPN);

// MoMo public
publicRouter.get("/momo/return", momoController.momoReturn);
publicRouter.post("/momo/ipn", express.json(), momoController.momoIPN);

/* ---------- EXPORT ---------- */
const router = express.Router();

// Gắn các router vào cùng namespace `/api/payment`
router.use("/", securedRouter);
router.use("/", publicRouter);

export default router;
