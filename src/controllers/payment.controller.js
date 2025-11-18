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

            // Tự động complete checkin nếu là bill RECEIPT đã PAID
            if (bill.billType === "RECEIPT" && bill.status === "PAID") {
                console.log(`🔍 Bill is RECEIPT and PAID, checking for checkin with receiptBillId: ${bill._id}`);
                const Checkin = (await import("../models/checkin.model.js")).default;
                const checkin = await Checkin.findOne({ receiptBillId: bill._id }).session(session);
                console.log(`🔍 Found checkin:`, checkin ? `ID=${checkin._id}, status=${checkin.status}` : 'null');
                if (checkin && checkin.status === "CREATED") {
                    checkin.status = "COMPLETED";
                    await checkin.save({ session });
                    console.log(`✅ Auto-completed checkin ${checkin._id} after payment`);
                } else if (checkin) {
                    console.log(`⚠️ Checkin found but status is ${checkin.status}, not CREATED`);
                } else {
                    console.log(`⚠️ No checkin found with receiptBillId: ${bill._id}`);
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

        // Tự động complete checkin nếu là bill RECEIPT đã PAID (fallback mode)
        if (bill.billType === "RECEIPT" && bill.status === "PAID") {
            console.log(`🔍 [FALLBACK] Bill is RECEIPT and PAID, checking for checkin with receiptBillId: ${bill._id}`);
            const Checkin = (await import("../models/checkin.model.js")).default;
            const checkin = await Checkin.findOne({ receiptBillId: bill._id });
            console.log(`🔍 [FALLBACK] Found checkin:`, checkin ? `ID=${checkin._id}, status=${checkin.status}` : 'null');
            if (checkin && checkin.status === "CREATED") {
                checkin.status = "COMPLETED";
                await checkin.save();
                console.log(`✅ Auto-completed checkin ${checkin._id} after payment (fallback)`);
            } else if (checkin) {
                console.log(`⚠️ [FALLBACK] Checkin found but status is ${checkin.status}, not CREATED`);
            } else {
                console.log(`⚠️ [FALLBACK] No checkin found with receiptBillId: ${bill._id}`);
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

        const balance = decToNumber(bill.amountDue) - decToNumber(bill.amountPaid);
        if (Number(amount) <= 0 || Number(amount) > balance + 0.001) {
            return res.status(400).json({ error: "Invalid amount" });
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
        const params = req.body || {};
        const verify = vnpayService.verifyVnPayResponse(params);
        if (!verify.valid) {
            console.warn("VNPay IPN invalid checksum", verify);
            return res.json({ RspCode: "97", Message: "Invalid checksum" });
        }

        const txnRef = params.vnp_TxnRef;
        const rspCode = params.vnp_ResponseCode;

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
            try {
                await applyPaymentToBill(payment, params);
                return res.json({ RspCode: "00", Message: "Confirm Success" });
            } catch (e) {
                console.error("IPN applyPaymentToBill error:", e);
                return res.json({ RspCode: "99", Message: "Internal error" });
            }
        } else {
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