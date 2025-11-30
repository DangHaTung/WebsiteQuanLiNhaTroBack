import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";
import vnpayService from "../services/providers/vnpay.service.js";

// helper: convert Decimal128 -> number
function decToNumber(dec) {
    if (!dec) return 0;
    try { return parseFloat(dec.toString()); } catch (e) { return 0; }
}

// Helper chung: apply payment to bill atomically (dùng session)
// Helper chung: apply payment to bill
// Tự động fallback nếu MongoDB không hỗ trợ transaction (standalone)
export async function applyPaymentToBill(payment, rawParams = {}) {
    if (!payment || !payment.billId) throw new Error("Payment or billId missing");

    let session;
    try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            const bill = await Bill.findById(payment.billId).session(session);
            if (!bill) throw new Error("Bill not found");

            const exists = (bill.payments || []).find(
                (p) => p.transactionId === payment.transactionId && p.provider === payment.provider
            );
            if (exists) {
                if (payment.status !== "SUCCESS") {
                    payment.status = "SUCCESS";
                    payment.metadata = rawParams;
                    await payment.save({ session });
                }
                return;
            }

            const amountNum = decToNumber(payment.amount);
            if (amountNum <= 0) throw new Error("Invalid payment amount");

            bill.payments = bill.payments || [];
            bill.payments.push({
                paidAt: new Date(),
                amount: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
                method: payment.method || payment.provider,
                provider: payment.provider,
                transactionId: payment.transactionId,
                note: rawParams?.note || "Auto apply",
                metadata: rawParams,
            });

            const prevPaid = decToNumber(bill.amountPaid);
            const newPaid = prevPaid + amountNum;
            bill.amountPaid = mongoose.Types.Decimal128.fromString(newPaid.toFixed(2));

            const due = decToNumber(bill.amountDue);
            if (newPaid >= due) bill.status = "PAID";
            else if (newPaid > 0) bill.status = "PARTIALLY_PAID";
            else bill.status = "UNPAID";

            await bill.save({ session });

            // Giữ lại returnUrl từ metadata cũ khi update
            const oldReturnUrl = payment.metadata?.returnUrl;
            payment.status = "SUCCESS";
            payment.metadata = { ...rawParams, returnUrl: oldReturnUrl };
            await payment.save({ session });

            // Tự động complete checkin và cập nhật room status nếu là bill RECEIPT đã PAID
            if (bill.billType === "RECEIPT" && bill.status === "PAID") {
                console.log(`🔍 Bill is RECEIPT and PAID, checking for checkin with receiptBillId: ${bill._id}`);
                const Checkin = (await import("../models/checkin.model.js")).default;
                const Room = (await import("../models/room.model.js")).default;
                const checkin = await Checkin.findOne({ receiptBillId: bill._id }).populate("roomId").session(session);
                console.log(`🔍 Found checkin:`, checkin ? `ID=${checkin._id}, status=${checkin.status}` : 'null');
                if (checkin && checkin.status === "CREATED") {
                    checkin.status = "COMPLETED";
                    checkin.receiptPaidAt = new Date(); // Lưu thời điểm thanh toán phiếu thu
                    await checkin.save({ session });
                    console.log(`✅ Auto-completed checkin ${checkin._id} after payment, receiptPaidAt: ${checkin.receiptPaidAt}`);
                    
                    // Cập nhật room status = DEPOSITED, occupantCount = 0
                    if (checkin.roomId) {
                        const room = await Room.findById(checkin.roomId._id || checkin.roomId).session(session);
                        if (room) {
                            room.status = "DEPOSITED";
                            // occupantCount vẫn là 0 (chưa vào ở)
                            await room.save({ session });
                            console.log(`✅ Updated room ${room._id} status to DEPOSITED`);
                        }
                    }
                    
                    // ✅ Tự động tạo account và gửi email
                    try {
                        const { autoCreateAccountAndSendEmail } = await import("../services/user/autoCreateAccount.service.js");
                        await autoCreateAccountAndSendEmail(checkin);
                        console.log(`✅ Auto-created account and sent email for checkin ${checkin._id}`);
                    } catch (emailErr) {
                        console.error(`❌ Failed to create account/send email for checkin ${checkin._id}:`, emailErr);
                        // Không throw error để không block payment flow
                    }
                } else if (checkin) {
                    console.log(`⚠️ Checkin found but status is ${checkin.status}, not CREATED`);
                } else {
                    console.log(`⚠️ No checkin found with receiptBillId: ${bill._id}`);
                }
            }
            
            // Cập nhật room status = OCCUPIED và occupantCount khi thanh toán CONTRACT bill
            if (bill.billType === "CONTRACT" && bill.status === "PAID" && bill.contractId) {
                const Room = (await import("../models/room.model.js")).default;
                const Contract = (await import("../models/contract.model.js")).default;
                const contract = await Contract.findById(bill.contractId).populate("roomId").session(session);
                if (contract && contract.roomId) {
                    const room = await Room.findById(contract.roomId._id || contract.roomId).session(session);
                    if (room) {
                        room.status = "OCCUPIED";
                        // Cập nhật occupantCount từ contract (nếu có)
                        // Note: occupantCount có thể được tính từ số tenant + co-tenants
                        const occupantCount = contract.coTenants?.length ? contract.coTenants.length + 1 : 1;
                        room.occupantCount = occupantCount;
                        await room.save({ session });
                        console.log(`✅ Updated room ${room._id} status to OCCUPIED, occupantCount: ${occupantCount}`);
                    }
                }
            }
        });
    } catch (err) {
        // fallback nếu MongoDB không hỗ trợ transaction
        const unsupported = err?.code === 20 || /Transaction numbers/.test(err?.message || "");
        if (!unsupported) throw err;

        console.warn("⚠️ MongoDB không hỗ trợ transaction, fallback non-transaction mode");

        const bill = await Bill.findById(payment.billId);
        if (!bill) throw new Error("Bill not found");

        const exists = (bill.payments || []).find(
            (p) => p.transactionId === payment.transactionId && p.provider === payment.provider
        );
        if (exists) {
            if (payment.status !== "SUCCESS") {
                payment.status = "SUCCESS";
                payment.metadata = rawParams;
                await payment.save();
            }
            return;
        }

        const amountNum = decToNumber(payment.amount);
        if (amountNum <= 0) throw new Error("Invalid payment amount");

        bill.payments = bill.payments || [];
        bill.payments.push({
            paidAt: new Date(),
            amount: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
            method: payment.method || payment.provider,
            provider: payment.provider,
            transactionId: payment.transactionId,
            note: rawParams?.note || "Auto apply",
            metadata: rawParams,
        });

        const prevPaid = decToNumber(bill.amountPaid);
        const newPaid = prevPaid + amountNum;
        bill.amountPaid = mongoose.Types.Decimal128.fromString(newPaid.toFixed(2));

        const due = decToNumber(bill.amountDue);
        if (newPaid >= due) bill.status = "PAID";
        else if (newPaid > 0) bill.status = "PARTIALLY_PAID";
        else bill.status = "UNPAID";

        await bill.save();

        // Giữ lại returnUrl từ metadata cũ khi update (fallback mode)
        const oldReturnUrl = payment.metadata?.returnUrl;
        payment.status = "SUCCESS";
        payment.metadata = { ...rawParams, returnUrl: oldReturnUrl };
        await payment.save();

        // Tự động complete checkin và cập nhật room status nếu là bill RECEIPT đã PAID (fallback mode)
        if (bill.billType === "RECEIPT" && bill.status === "PAID") {
            console.log(`🔍 [FALLBACK] Bill is RECEIPT and PAID, checking for checkin with receiptBillId: ${bill._id}`);
            const Checkin = (await import("../models/checkin.model.js")).default;
            const Room = (await import("../models/room.model.js")).default;
            const checkin = await Checkin.findOne({ receiptBillId: bill._id }).populate("roomId");
            console.log(`🔍 [FALLBACK] Found checkin:`, checkin ? `ID=${checkin._id}, status=${checkin.status}` : 'null');
            if (checkin && checkin.status === "CREATED") {
                checkin.status = "COMPLETED";
                checkin.receiptPaidAt = new Date(); // Lưu thời điểm thanh toán phiếu thu
                await checkin.save();
                console.log(`✅ Auto-completed checkin ${checkin._id} after payment (fallback), receiptPaidAt: ${checkin.receiptPaidAt}`);
                
                // Cập nhật room status = DEPOSITED, occupantCount = 0
                if (checkin.roomId) {
                    const room = await Room.findById(checkin.roomId._id || checkin.roomId);
                    if (room) {
                        room.status = "DEPOSITED";
                        room.occupantCount = 0; // Chưa vào ở
                        await room.save();
                        console.log(`✅ [FALLBACK] Updated room ${room._id} status to DEPOSITED`);
                    }
                }
                
                // ✅ Tự động tạo account và gửi email (fallback mode)
                try {
                    const { autoCreateAccountAndSendEmail } = await import("../services/user/autoCreateAccount.service.js");
                    await autoCreateAccountAndSendEmail(checkin);
                    console.log(`✅ Auto-created account and sent email for checkin ${checkin._id} (fallback)`);
                } catch (emailErr) {
                    console.error(`❌ Failed to create account/send email for checkin ${checkin._id} (fallback):`, emailErr);
                    // Không throw error để không block payment flow
                }
            } else if (checkin) {
                console.log(`⚠️ [FALLBACK] Checkin found but status is ${checkin.status}, not CREATED`);
            } else {
                console.log(`⚠️ [FALLBACK] No checkin found with receiptBillId: ${bill._id}`);
            }
        }
        
        // Cập nhật room status = OCCUPIED và occupantCount khi thanh toán CONTRACT bill (fallback mode)
        if (bill.billType === "CONTRACT" && bill.status === "PAID" && bill.contractId) {
            const Room = (await import("../models/room.model.js")).default;
            const Contract = (await import("../models/contract.model.js")).default;
            const contract = await Contract.findById(bill.contractId).populate("roomId");
            if (contract && contract.roomId) {
                const room = await Room.findById(contract.roomId._id || contract.roomId);
                if (room) {
                    room.status = "OCCUPIED";
                    const occupantCount = contract.coTenants?.length ? contract.coTenants.length + 1 : 1;
                    room.occupantCount = occupantCount;
                    await room.save();
                    console.log(`✅ [FALLBACK] Updated room ${room._id} status to OCCUPIED, occupantCount: ${occupantCount}`);
                }
            }
        }
    } finally {
        if (session) session.endSession();
    }
}

// ============== createPayment ==============
// POST /pay/create
// body: { billId, amount, provider, bankCode? }
export const createPayment = async (req, res) => {
    console.log('[HANDLER] createPayment called', req.method, req.originalUrl, 'authHeader=', req.headers.authorization);

    try {
        const { billId, amount, provider = "VNPAY", bankCode, returnUrl } = req.body;
        if (!billId || !amount) return res.status(400).json({ error: "billId and amount required" });

        const bill = await Bill.findById(billId);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        const amountDue = decToNumber(bill.amountDue);
        const amountPaid = decToNumber(bill.amountPaid);
        const balance = amountDue - amountPaid;
        
        console.log("💰 Payment validation - Amount:", amount, "AmountDue:", amountDue, "Balance:", balance);
        console.log("📊 Bill details:", {
            amountDue,
            amountPaid,
            balance,
            billType: bill.billType,
            status: bill.status
        });
        
        // Cho phép thanh toán theo amountDue hoặc balance
        if (Number(amount) <= 0 || Number(amount) > amountDue + 1) {
            console.log("❌ Invalid amount - Amount must be between 0 and", amountDue);
            return res.status(400).json({ error: "Invalid amount", amount, maxAmount: amountDue });
        }

        const providerUpper = provider.toUpperCase();

        // generate local transactionId (we use this as vnp_TxnRef)
        const txnRef = uuidv4().replace(/-/g, "");

        // create Payment record (PENDING) with returnUrl in metadata
        console.log("💾 Creating payment with returnUrl:", returnUrl);
        const payment = await Payment.create({
            billId,
            provider: providerUpper,
            transactionId: txnRef,
            amount: mongoose.Types.Decimal128.fromString(Number(amount).toFixed(2)),
            status: "PENDING",
            method: "REDIRECT",
            metadata: { returnUrl: returnUrl || null },
        });
        console.log("✅ Payment created with metadata:", payment.metadata);

        // build provider URL (VNPay example)
        if (providerUpper === "VNPAY") {
            const ipAddr = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "";
            const { paymentUrl } = vnpayService.buildVnPayUrl({
                amount: Number(amount),
                orderId: txnRef,
                orderInfo: `bill:${billId}`, // helpful for parsing if needed
                bankCode,
                ipAddr,
            });
            return res.json({ url: paymentUrl });
        }

        // TODO: add momo/zalo logic similarly
        return res.status(400).json({ error: "Unsupported provider" });
    } catch (err) {
        console.error("createPayment error:", err);
        return res.status(500).json({ error: "Server error" });
    }
};

// ============== vnpayReturn ==============
// GET /pay/vnpay/return
export const vnpayReturn = async (req, res) => {
    try {
        const params = req.query || {};
        const verify = vnpayService.verifyVnPayResponse(params);
        if (!verify.valid) {
            console.warn("VNPay return invalid checksum", verify);
            return res.status(400).send("Invalid checksum");
        }

        const txnRef = params.vnp_TxnRef;
        const rspCode = params.vnp_ResponseCode;

        const payment = await Payment.findOne({ provider: "VNPAY", transactionId: txnRef });
        if (!payment) {
            // could parse billId from orderInfo if needed
            return res.status(404).send("Payment record not found");
        }

        if (payment.status === "SUCCESS") {
            return res.send("Payment already processed");
        }

        if (rspCode === "00") {
            // apply payment via transaction helper, sau đó redirect về frontend success
            try {
                // Lưu returnUrl TRƯỚC KHI apply (vì applyPaymentToBill sẽ ghi đè metadata)
                const savedReturnUrl = payment.metadata?.returnUrl;
                console.log("💾 Saved returnUrl before apply:", savedReturnUrl);
                
                await applyPaymentToBill(payment, params);
                
                // Get bill and contract info for email
                const bill = await Bill.findById(payment.billId).populate('contractId');
                
                // Auto-create account if this is a public payment (guest checkout)
                if (bill && bill.paymentToken) {
                    console.log("🔍 Detected public payment, auto-creating account...");
                    const { autoCreateAccountAfterPayment } = await import("./publicPayment.controller.js");
                    await autoCreateAccountAfterPayment(bill);
                }
                
                // Send payment success email to tenant
                if (bill && bill.contractId) {
                    try {
                        const contract = bill.contractId;
                        const tenantEmail = contract.tenantSnapshot?.email || contract.tenantId?.email;
                        const tenantName = contract.tenantSnapshot?.fullName || contract.tenantId?.fullName || "Khách hàng";
                        
                        if (tenantEmail) {
                            const { sendPaymentSuccessEmail } = await import("../services/email/notification.service.js");
                            await sendPaymentSuccessEmail({
                                to: tenantEmail,
                                fullName: tenantName,
                                bill: bill,
                                amount: decToNumber(payment.amount),
                                transactionId: txnRef,
                                provider: "VNPAY",
                            });
                            console.log("📧 Sent payment success email to:", tenantEmail);
                        }
                    } catch (emailError) {
                        console.error("❌ Error sending payment success email:", emailError);
                        // Don't fail the payment if email fails
                    }
                }
                
                // Ưu tiên returnUrl đã lưu, fallback về default
                const returnUrl = savedReturnUrl || `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin/checkins`;
                console.log("🔗 Using returnUrl:", returnUrl);
                const redirectUrl = `${returnUrl}?payment=success&provider=vnpay&transactionId=${txnRef}`;
                console.log("➡️ Redirecting to:", redirectUrl);
                
                return res.redirect(redirectUrl);
            } catch (e) {
                console.error("applyPaymentToBill error (return):", e);
                return res.status(500).send("Server error while applying payment");
            }
        } else {
            payment.status = "FAILED";
            payment.metadata = params;
            await payment.save();
            return res.send("Payment failed or cancelled");
        }
    } catch (err) {
        console.error("vnpayReturn error:", err);
        return res.status(500).send("Server error");
    }
};

// ============== vnpayIPN ==============
// POST /pay/vnpay/ipn
export const vnpayIPN = async (req, res) => {
    try {
        console.log("🔔 VNPay IPN received:", new Date().toISOString());
        console.log("📥 VNPay IPN params:", JSON.stringify(req.body, null, 2));
        
        const params = req.body || {};
        const verify = vnpayService.verifyVnPayResponse(params);
        if (!verify.valid) {
            console.warn("❌ VNPay IPN invalid checksum", verify);
            return res.json({ RspCode: "97", Message: "Invalid checksum" });
        }

        const txnRef = params.vnp_TxnRef;
        const rspCode = params.vnp_ResponseCode;
        
        console.log("📦 VNPay IPN data:", {
            txnRef,
            rspCode,
            amount: params.vnp_Amount,
            orderInfo: params.vnp_OrderInfo,
            status: rspCode === "00" ? "SUCCESS" : "FAILED"
        });

        // find existing Payment
        let payment = await Payment.findOne({ provider: "VNPAY", transactionId: txnRef });

        if (!payment) {
            // Best practice: parse billId from vnp_OrderInfo if you embedded it in createPayment
            const orderInfo = params.vnp_OrderInfo || "";
            const billId = (orderInfo && orderInfo.startsWith("bill:")) ? orderInfo.split("bill:")[1] : null;

            if (!billId) {
                console.warn("IPN: payment not found and billId not provided in orderInfo. txnRef=", txnRef);
                return res.json({ RspCode: "01", Message: "Payment record not found" });
            }

            // compute amount (VNPay may send amount*100 depending on env)
            const raw = params.vnp_Amount || "0";
            const amountNum = Number(raw) / (process.env.VNP_MULTIPLY_100 === "true" ? 100 : 1);

            payment = await Payment.create({
                billId,
                provider: "VNPAY",
                transactionId: txnRef,
                amount: mongoose.Types.Decimal128.fromString(Number(amountNum).toFixed(2)),
                status: "PENDING",
                method: "REDIRECT",
                metadata: params,
            });
        }

        if (payment.status === "SUCCESS") {
            return res.json({ RspCode: "00", Message: "Already processed" });
        }

        if (rspCode === "00") {
            // apply and respond confirm
            console.log("✅ VNPay IPN payment SUCCESS - Processing...");
            try {
                await applyPaymentToBill(payment, params);
                console.log("✅ VNPay IPN payment applied successfully to bill");
                return res.json({ RspCode: "00", Message: "Confirm Success" });
            } catch (e) {
                console.error("❌ VNPay IPN applyPaymentToBill error:", e);
                console.error("❌ Error stack:", e.stack);
                return res.json({ RspCode: "99", Message: "Internal error" });
            }
        } else {
            console.log("❌ VNPay IPN payment FAILED - Response code:", rspCode);
            payment.status = "FAILED";
            payment.metadata = params;
            await payment.save();
            // VNPay often expects 00 even on fail to stop retries — check spec. Here we return 00 per some docs.
            return res.json({ RspCode: "00", Message: "Transaction failed" });
        }
    } catch (err) {
        console.error("vnpayIPN error:", err);
        return res.json({ RspCode: "99", Message: "Internal error" });
    }
};

export default {
    createPayment,
    vnpayReturn,
    vnpayIPN,
    applyPaymentToBill,
};