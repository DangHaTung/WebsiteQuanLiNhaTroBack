// Public Payment Controller - Guest checkout without login
import mongoose from "mongoose";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import Bill from "../models/bill.model.js";
import Contract from "../models/contract.model.js";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import vnpayService from "../services/providers/vnpay.service.js";
import { sendPaymentLinkEmail, sendAccountCreatedEmail } from "../services/email/notification.service.js";
import { uploadReceiptImage } from "../middleware/upload.middleware.js";

function decToNumber(dec) {
  if (!dec) return 0;
  try { return parseFloat(dec.toString()); } catch (e) { return 0; }
}

/**
 * Generate secure payment token for bill
 * POST /api/admin/bills/:billId/generate-payment-link
 */
export const generatePaymentLink = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { billId } = req.params;
    const bill = await Bill.findById(billId).populate("contractId");
    
    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    // Only allow for RECEIPT bills (deposit)
    if (bill.billType !== "RECEIPT") {
      return res.status(400).json({ success: false, message: "Chỉ có thể tạo link thanh toán cho phiếu thu đặt cọc" });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 5); // Valid for 5 days

    bill.paymentToken = token;
    bill.paymentTokenExpires = expiresAt;
    await bill.save();

    // Build payment URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const paymentUrl = `${frontendUrl}/public/payment/${billId}/${token}`;

    // Get tenant info from contract
    const contract = bill.contractId;
    const tenantEmail = contract.tenantSnapshot?.email || contract.tenantId?.email;
    const tenantName = contract.tenantSnapshot?.fullName || contract.tenantId?.fullName || "Khách hàng";
    
    // Get room info
    const room = await Room.findById(contract.roomId);
    const roomNumber = room?.roomNumber || "N/A";

    // Send email with payment link
    if (tenantEmail) {
      await sendPaymentLinkEmail({
        to: tenantEmail,
        fullName: tenantName,
        paymentUrl,
        billId: bill._id.toString(),
        amount: decToNumber(bill.amountDue),
        roomNumber,
        expiresAt,
        paymentToken: token, // ✅ Thêm paymentToken để tạo link upload ảnh
      });
    }

    return res.status(200).json({
      success: true,
      message: "Link thanh toán đã được tạo và gửi email",
      data: {
        paymentUrl,
        token,
        expiresAt,
        emailSent: !!tenantEmail,
      },
    });
  } catch (error) {
    console.error("generatePaymentLink error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Verify token and get bill info (PUBLIC - no auth required)
 * GET /api/public/payment/:billId/:token
 */
export const verifyTokenAndGetBill = async (req, res) => {
  try {
    const { billId, token } = req.params;

    const bill = await Bill.findById(billId).populate({
      path: "contractId",
      populate: { path: "roomId", select: "roomNumber type" },
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    // Verify token
    if (bill.paymentToken !== token) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }

    // Check if token expired
    if (bill.paymentTokenExpires && new Date() > bill.paymentTokenExpires) {
      return res.status(401).json({ success: false, message: "Link thanh toán đã hết hạn" });
    }

    // Return bill info
    const contract = bill.contractId;
    const room = contract?.roomId;

    return res.status(200).json({
      success: true,
      data: {
        bill: {
          _id: bill._id,
          billType: bill.billType,
          status: bill.status,
          amountDue: decToNumber(bill.amountDue),
          amountPaid: decToNumber(bill.amountPaid),
          billingDate: bill.billingDate,
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
    console.error("verifyTokenAndGetBill error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Create payment URL for guest (PUBLIC - no auth required)
 * POST /api/public/payment/:billId/:token/create
 */
export const createPublicPayment = async (req, res) => {
  try {
    const { billId, token } = req.params;
    const { provider = "VNPAY", amount } = req.body;

    // Verify token first
    const bill = await Bill.findById(billId).populate("contractId");
    
    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    if (bill.paymentToken !== token) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }

    if (bill.paymentTokenExpires && new Date() > bill.paymentTokenExpires) {
      return res.status(401).json({ success: false, message: "Link thanh toán đã hết hạn" });
    }

    // Check amount
    const balance = decToNumber(bill.amountDue) - decToNumber(bill.amountPaid);
    console.log("💰 Public payment controller validation - Amount:", amount, "Balance:", balance);
    if (Number(amount) <= 0 || Number(amount) > balance + 1) {
      console.log("❌ Invalid amount in public controller - Amount must be between 0 and", balance);
      return res.status(400).json({ success: false, message: "Số tiền không hợp lệ", amount, balance });
    }

    const providerUpper = provider.toUpperCase();
    const txnRef = uuidv4().replace(/-/g, "");

    // Build return URL to public payment page
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const returnUrl = `${frontendUrl}/public/payment/${billId}/${token}/success`;

    // Create Payment record with returnUrl
    const payment = await Payment.create({
      billId,
      provider: providerUpper,
      transactionId: txnRef,
      amount: mongoose.Types.Decimal128.fromString(Number(amount).toFixed(2)),
      status: "PENDING",
      method: "REDIRECT",
      metadata: { returnUrl, isPublicPayment: true, billId, token },
    });

    // Build provider URL
    if (providerUpper === "VNPAY") {
      const { paymentUrl } = vnpayService.buildVnPayUrl({
        amount: Number(amount),
        orderId: txnRef,
        orderInfo: `bill:${billId}`,
        ipAddr: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "",
      });
      return res.json({ success: true, url: paymentUrl });
    }

    return res.status(400).json({ success: false, message: "Provider không được hỗ trợ" });
  } catch (error) {
    console.error("createPublicPayment error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Auto create account after successful payment
 * Called from payment.controller.js after payment is confirmed
 */
export async function autoCreateAccountAfterPayment(bill) {
  try {
    console.log(`🔍 Checking if need to auto-create account for bill ${bill._id}`);

    // Only for RECEIPT bills (deposit)
    if (bill.billType !== "RECEIPT") {
      console.log("⏭️  Not a RECEIPT bill, skip auto-create account");
      return;
    }

    // Only if bill is PAID
    if (bill.status !== "PAID") {
      console.log("⏭️  Bill not PAID yet, skip auto-create account");
      return;
    }

    // Get contract
    const contract = await Contract.findById(bill.contractId);
    if (!contract) {
      console.log("⚠️  Contract not found");
      return;
    }

    // Check if tenant already has account
    if (contract.tenantId) {
      console.log("⏭️  Tenant already has account, skip");
      return;
    }

    // Get tenant info from snapshot
    const { fullName, email, phone } = contract.tenantSnapshot || {};
    
    if (!email || !phone) {
      console.log("⚠️  Missing email or phone in tenantSnapshot");
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      console.log("⏭️  User already exists, linking to contract");
      contract.tenantId = existingUser._id;
      await contract.save();
      return;
    }

    // Generate random password
    const password = crypto.randomBytes(4).toString("hex"); // 8 characters
    const bcrypt = (await import("bcrypt")).default;
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user account
    const newUser = await User.create({
      fullName,
      email,
      phone,
      passwordHash,
      role: "TENANT",
      identityNo: contract.tenantSnapshot?.identityNo,
    });

    console.log(`✅ Auto-created account for ${email}`);

    // Link user to contract
    contract.tenantId = newUser._id;
    await contract.save();

    // Send email with account info
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const loginUrl = `${frontendUrl}/login`;

    await sendAccountCreatedEmail({
      to: email,
      fullName,
      email,
      password,
      loginUrl,
    });

    console.log(`📧 Sent account info email to ${email}`);
  } catch (error) {
    console.error("autoCreateAccountAfterPayment error:", error);
    // Don't throw error, just log it
  }
}

/**
 * Upload receipt image for cash payment (PUBLIC - no auth required, uses paymentToken)
 * POST /api/public/payment/:billId/:token/upload-receipt
 */
export const uploadReceiptForCashPayment = async (req, res) => {
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

    // Validate amount
    const amountNum = amount ? Number(amount) : decToNumber(bill.amountDue);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: "Số tiền không hợp lệ" });
    }

    // Calculate balance
    const amountDue = decToNumber(bill.amountDue);
    const amountPaid = decToNumber(bill.amountPaid);
    let balance = 0;
    
    if (bill.billType === "CONTRACT" && (bill.status === "UNPAID" || bill.status === "PENDING_CASH_CONFIRM")) {
      balance = amountDue;
    } else {
      balance = amountDue - amountPaid;
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
};

export default {
  generatePaymentLink,
  verifyTokenAndGetBill,
  createPublicPayment,
  autoCreateAccountAfterPayment,
  uploadReceiptForCashPayment,
};
