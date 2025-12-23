// Public payment routes - không cần authentication
import express from "express";
import Bill from "../models/bill.model.js";
import Contract from "../models/contract.model.js";
import Room from "../models/room.model.js";
import paymentController from "../controllers/payment.controller.js";
import momoController from "../controllers/momo.controller.js";
import zaloController from "../controllers/paymentZalo.controller.js";
import { uploadReceiptImage } from "../middleware/upload.middleware.js";

const router = express.Router();

/**
 * Verify payment token and get bill info
 * GET /api/public/payment/:billId/:token
 */
router.get("/payment/:billId/:token", async (req, res) => {
  try {
    const { billId, token } = req.params;

    const bill = await Bill.findById(billId).populate("contractId");
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    // Verify token
    if (!bill.paymentToken || bill.paymentToken !== token) {
      return res.status(400).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    // Check token expiry
    if (bill.paymentTokenExpires && new Date() > bill.paymentTokenExpires) {
      return res.status(400).json({
        success: false,
        message: "Link thanh toán đã hết hạn",
      });
    }

    // Get contract and room info (không block nếu đã thanh toán, vẫn cho xem thông tin)
    const contract = bill.contractId;
    const room = contract ? await Room.findById(contract.roomId) : null;

    // Format bill for response
    const convertDecimal128 = (value) => {
      if (value === null || value === undefined) return null;
      return parseFloat(value.toString());
    };

    return res.status(200).json({
      success: true,
      data: {
        bill: {
          _id: bill._id,
          billType: bill.billType,
          status: bill.status,
          amountDue: convertDecimal128(bill.amountDue),
          amountPaid: convertDecimal128(bill.amountPaid),
          billingDate: bill.billingDate,
          metadata: bill.metadata || {}, // ✅ Thêm metadata để frontend có thể check receiptImage
        },
        contract: contract ? {
          _id: contract._id,
          tenantSnapshot: contract.tenantSnapshot,
        } : null,
        room: room ? {
          _id: room._id,
          roomNumber: room.roomNumber,
          type: room.type,
        } : null,
      },
    });
  } catch (error) {
    console.error("verifyPaymentToken error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xác thực token",
      error: error.message,
    });
  }
});

/**
 * Create payment from public link (no auth required)
 * POST /api/public/payment/:billId/:token/create
 */
router.post("/payment/:billId/:token/create", async (req, res) => {
  try {
    const { billId, token } = req.params;
    const { provider = "VNPAY", bankCode, amount } = req.body;

    // Verify token first
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (!bill.paymentToken || bill.paymentToken !== token) {
      return res.status(400).json({ error: "Token không hợp lệ" });
    }

    if (bill.paymentTokenExpires && new Date() > bill.paymentTokenExpires) {
      return res.status(400).json({ error: "Link thanh toán đã hết hạn" });
    }

    if (bill.status === "PAID") {
      return res.status(400).json({ error: "Bill đã thanh toán rồi" });
    }

    // Calculate amount to pay
    const convertDecimal128 = (value) => {
      if (value === null || value === undefined) return 0;
      return parseFloat(value.toString());
    };

    const amountDue = convertDecimal128(bill.amountDue);
    const amountPaid = convertDecimal128(bill.amountPaid);
    const balance = amountDue - amountPaid;

    const paymentAmount = amount || balance;
    console.log("💰 Public route validation - Amount:", paymentAmount, "Balance:", balance);
    if (Number(paymentAmount) <= 0 || Number(paymentAmount) > balance + 1) {
      console.log("❌ Invalid amount in public route - Amount must be between 0 and", balance);
      return res.status(400).json({ error: "Invalid amount", amount: paymentAmount, balance });
    }

    // Build return URL (public payment success page)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const returnUrl = `${frontendUrl}/public/payment/${billId}/${token}/success`;

    // Create payment using existing controller
    // Temporarily set req.body for createPayment
    req.body = {
      billId,
      amount: paymentAmount,
      provider,
      bankCode,
      returnUrl,
    };

    // Call createPayment from payment controller
    if (provider.toUpperCase() === "VNPAY") {
      return await paymentController.createPayment(req, res);
    } else if (provider.toUpperCase() === "MOMO") {
      return await momoController.createPayment(req, res);
    } else if (provider.toUpperCase() === "ZALOPAY") {
      return await zaloController.createZaloOrder(req, res);
    } else {
      return res.status(400).json({ error: "Unsupported provider" });
    }
  } catch (error) {
    console.error("createPublicPayment error:", error);
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
});

/**
 * Upload receipt image for cash payment (PUBLIC - no auth required, uses paymentToken)
 * POST /api/public/payment/:billId/:token/upload-receipt
 */
router.post("/payment/:billId/:token/upload-receipt", uploadReceiptImage, async (req, res) => {
  console.log("📤 [PUBLIC UPLOAD RECEIPT] Request received:", {
    billId: req.params.billId,
    token: req.params.token?.substring(0, 10) + "...",
    hasFile: !!req.file,
  });
  try {
    const { billId, token } = req.params;
    const { amount } = req.body;

    // Verify token
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    if (!bill.paymentToken || bill.paymentToken !== token) {
      return res.status(403).json({ success: false, message: "Token không hợp lệ" });
    }

    if (bill.paymentTokenExpires && new Date() > bill.paymentTokenExpires) {
      return res.status(403).json({ success: false, message: "Token đã hết hạn" });
    }

    // Check bill status
    if (bill.status === "PAID") {
      return res.status(400).json({ success: false, message: "Hóa đơn này đã được thanh toán" });
    }

    if (bill.status === "PENDING_CASH_CONFIRM") {
      return res.status(400).json({ 
        success: false, 
        message: "Hóa đơn này đang chờ admin xác nhận. Vui lòng chờ xử lý." 
      });
    }

    // Convert Decimal128 to number
    const convertDecimal128 = (value) => {
      if (value === null || value === undefined) return 0;
      return parseFloat(value.toString());
    };

    // Validate amount
    const amountDue = convertDecimal128(bill.amountDue);
    const amountPaid = convertDecimal128(bill.amountPaid);
    let balance = 0;
    
    if (bill.billType === "CONTRACT" && (bill.status === "UNPAID" || bill.status === "PENDING_CASH_CONFIRM")) {
      balance = amountDue;
    } else {
      balance = amountDue - amountPaid;
    }

    const amountNum = amount ? Number(amount) : balance;
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: "Số tiền không hợp lệ" });
    }

    if (amountNum > balance + 1) {
      return res.status(400).json({
        success: false,
        message: `Số tiền thanh toán (${amountNum.toLocaleString('vi-VN')} VNĐ) vượt quá số tiền còn lại (${balance.toLocaleString('vi-VN')} VNĐ)`,
      });
    }

    // Check if receipt image was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "Vui lòng upload ảnh bill chuyển khoản" 
      });
    }

    // Update bill status to PENDING_CASH_CONFIRM
    bill.status = "PENDING_CASH_CONFIRM";

    // Save request info to metadata
    if (!bill.metadata) bill.metadata = {};
    bill.metadata.cashPaymentRequest = {
      requestedAt: new Date(),
      requestedAmount: amountNum,
      requestedVia: "PUBLIC_PAYMENT_LINK", // Đánh dấu là từ public link
    };

    // Save receipt image
    bill.metadata.cashPaymentRequest.receiptImage = {
      url: req.file.path,
      secure_url: req.file.secure_url || req.file.path,
      public_id: req.file.filename,
      resource_type: req.file.resource_type || "image",
      format: req.file.format,
      bytes: req.file.size,
    };

    // Ensure Mongoose saves the metadata changes
    try {
      bill.markModified && bill.markModified('metadata');
    } catch (e) {
      // no-op
    }

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Đã gửi yêu cầu xác nhận thanh toán. Admin sẽ xem xét và xác nhận trong thời gian sớm nhất.",
      data: {
        billId: bill._id,
        status: bill.status,
      },
    });
  } catch (error) {
    console.error("uploadReceiptForCashPayment error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi khi upload ảnh bill", 
      error: error.message 
    });
  }
});

export default router;

