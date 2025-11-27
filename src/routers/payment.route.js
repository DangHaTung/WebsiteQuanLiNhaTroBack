// src/routers/payment.route.js
import express from "express";
import paymentController from "../controllers/payment.controller.js";
import momoController from "../controllers/momo.controller.js";
import zaloController from "../controllers/paymentZalo.controller.js";
import {
  optionalAuth /*, authenticateToken */,
} from "../middleware/auth.middleware.js";
console.log("[ROUTE] payment.route.js loaded");

const router = express.Router();

// ---------- PUBLIC callbacks (no auth) ----------
router.get("/vnpay/return", paymentController.vnpayReturn);
router.post(
  "/vnpay/ipn",
  express.urlencoded({ extended: false }),
  paymentController.vnpayIPN
);

router.get("/momo/return", momoController.momoReturn);
router.post("/momo/ipn", express.json(), momoController.momoIPN);

router.post(
  "/zalopay/callback",
  express.json(), // ZaloPay gửi callback dưới dạng application/json
  zaloController.zaloCallback
);
router.get("/zalopay/return", zaloController.zaloReturn);

// ---------- From this point, we DO NOT apply a global authenticateToken middleware.
// Instead, apply optionalAuth or authenticateToken per-route as needed.

// Use optionalAuth for create so the endpoint works without token (e.g. guest checkout),
// but if client sends Authorization: Bearer <token> then req.user will be available.
router.post("/vnpay/create", optionalAuth, paymentController.createPayment);
router.post("/momo/create", optionalAuth, momoController.createPayment);
router.post("/zalopay/create", zaloController.createZaloOrder);

// If you want create to require login, replace optionalAuth with authenticateToken:
// router.post("/vnpay/create", authenticateToken, paymentController.createPayment);

// Simple success endpoint for local redirect testing
router.get("/success", (req, res) => {
  const { orderId, amount } = req.query || {};
  return res.status(200).json({ success: true, message: "Payment success", orderId, amount });
});

export default router;
