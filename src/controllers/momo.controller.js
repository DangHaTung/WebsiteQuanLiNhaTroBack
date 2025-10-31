// src/controllers/momo.controller.js
import mongoose from "mongoose";
import crypto from "crypto";
import https from "https";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";
import Contract from "../models/contract.model.js";
import Room from "../models/room.model.js";
import Tenant from "../models/tenant.model.js";
import { applyPaymentToBill } from "../controllers/payment.controller.js"; // sử dụng helper hiện có

/**
 * Momo Controller — bản ổn định & đúng chuẩn test sandbox
 * - Tạo Payment PENDING trước khi redirect
 * - Lưu extraData chứa billId để IPN có thể map
 * - IPN là nguồn chân lý -> gọi applyPaymentToBill
 */

const getMomoConfig = () => ({
    accessKey: process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85",
    secretKey: process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
    redirectUrl: process.env.MOMO_RETURN_URL || "http://localhost:3000/api/payment/momo/return",
    ipnUrl: process.env.MOMO_IPN_URL || "http://localhost:3000/api/payment/momo/ipn",
});

/** Verify MoMo HMAC SHA256 signature
 *  Note: đảm bảo thứ tự các field khớp với spec MoMo (sandbox/prod)
 */
function verifyMomoSignature(body, secretKey) {
    if (!body || !body.signature) return false;
    const signature = body.signature;
    const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";

    const rawSignature =
        "accessKey=" + accessKey +
        "&amount=" + body.amount +
        "&extraData=" + (body.extraData || "") +
        "&message=" + (body.message || "") +
        "&orderId=" + body.orderId +
        "&orderInfo=" + (body.orderInfo || "") +
        "&orderType=" + (body.orderType || "") +
        "&partnerCode=" + body.partnerCode +
        "&payType=" + (body.payType || "") +
        "&requestId=" + body.requestId +
        "&responseTime=" + (body.responseTime || "") +
        "&resultCode=" + body.resultCode +
        "&transId=" + (body.transId || "");

    const computed = crypto
        .createHmac("sha256", secretKey)
        .update(rawSignature)
        .digest("hex");

    return computed === signature;
}


/** ============ CREATE PAYMENT ============ */
const createPayment = async (req, res) => {
    try {
        const { billId, amount: amountRaw, orderInfo = "" } = req.body;
        if (!billId || !amountRaw) return res.status(400).json({ success: false, message: "Thiếu billId hoặc amount" });

        const amountNum = Number(amountRaw);
        if (!(amountNum > 0)) return res.status(400).json({ success: false, message: "Amount không hợp lệ" });

        // validate bill
        const bill = await Bill.findById(billId).lean();
        if (!bill) return res.status(404).json({ success: false, message: "Bill không tồn tại" });
        if (bill.status === "PAID") return res.status(400).json({ success: false, message: "Bill đã được thanh toán" });

        // validate chain: contract -> room -> tenant (optional checks kept)
        const contractId = bill.contractId || bill.contract || bill.contract_id;
        if (!contractId)
            return res.status(400).json({ success: false, message: "Bill không liên kết contract" });

        const contract = await Contract.findById(contractId).lean();
        if (!contract)
            return res.status(400).json({ success: false, message: "Contract liên kết không tồn tại" });

        const roomId = contract.roomId || contract.room || contract.room_id;
        if (!roomId)
            return res.status(400).json({ success: false, message: "Contract không liên kết room" });

        const room = await Room.findById(roomId).lean();
        if (!room)
            return res.status(400).json({ success: false, message: "Room liên kết không tồn tại" });

        const tenantId = contract.tenantId || contract.tenant || contract.tenant_id;
        if (!tenantId)
            return res.status(400).json({
                success: false,
                message: "Contract chưa có tenant, không thể thu tiền",
            });

        // build momo config + orderId (unique)
        const { accessKey, secretKey, partnerCode, redirectUrl, ipnUrl } = getMomoConfig();
        const requestType = "payWithMethod";
        const orderId = partnerCode + new Date().getTime();
        const requestId = orderId;
        const extraData = JSON.stringify({ billId });

        // **Tạo Payment record PENDING trước khi gọi MoMo**
        const payment = await Payment.create({
            billId,
            provider: "MOMO",
            transactionId: orderId, // dùng làm orderRef locally
            amount: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
            status: "PENDING",
            method: "REDIRECT",
            metadata: { createdFrom: "createPayment", requestedAmount: amountNum, orderInfo },
        });

        // chuẩn bị payload gửi MoMo
        const orderInfoValue = (orderInfo && orderInfo.trim().length > 0
            ? orderInfo.trim()
            : `Thanh toán hóa đơn ${billId}`
        ).slice(0, 500);

        const rawSignature =
            "accessKey=" + accessKey +
            "&amount=" + amountNum +
            "&extraData=" + extraData +
            "&ipnUrl=" + ipnUrl +
            "&orderId=" + orderId +
            "&orderInfo=" + orderInfoValue +
            "&partnerCode=" + partnerCode +
            "&redirectUrl=" + redirectUrl +
            "&requestId=" + requestId +
            "&requestType=" + requestType;

        const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

        const requestBody = JSON.stringify({
            partnerCode,
            partnerName: "TailieuZHost",
            storeId: "MomoZHostStore",
            requestId,
            amount: amountNum,
            orderId,
            orderInfo: orderInfoValue,
            redirectUrl,
            ipnUrl,
            lang: "vi",
            requestType,
            autoCapture: true,
            extraData,
            signature,
        });

        const options = {
            hostname: "test-payment.momo.vn",
            port: 443,
            path: "/v2/gateway/api/create",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(requestBody),
            },
        };

        const momoReq = https.request(options, (momoRes) => {
            let data = "";
            momoRes.on("data", (chunk) => (data += chunk));
            momoRes.on("end", async () => {
                try {
                    const result = JSON.parse(data);

                    // cập nhật metadata và provider response (không finalize status here)
                    try {
                        payment.metadata = { ...payment.metadata, momoResponse: result };
                        await payment.save();
                    } catch (e) {
                        console.warn("Cannot update payment metadata:", e);
                    }

                    return res.json({ success: true, data: result, payUrl: result.payUrl, transactionId: orderId });
                } catch (err) {
                    console.error("Parse error:", err);
                    return res.status(500).json({ success: false, raw: data });
                }
            });
        });

        momoReq.on("error", (e) => {
            console.error("HTTPS error:", e.message);
            return res.status(500).json({ success: false, message: e.message });
        });

        momoReq.write(requestBody);
        momoReq.end();
    } catch (err) {
        console.error("createPayment error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/** ============ RETURN ============
 * NOTE: Return từ browser KHÔNG phải nguồn chân lý — chỉ hiển thị & lưu metadata.
 */
const momoReturn = async (req, res) => {
    try {
        const params = req.query || {};
        const { secretKey } = getMomoConfig();

        if (params.signature) {
            const ok = verifyMomoSignature(params, secretKey);
            if (!ok) console.warn("momoReturn: signature invalid", params);
            else params._signatureVerified = true;
        }

        const { resultCode, orderId, amount, message } = params;
        const success = Number(resultCode) === 0;

        // chỉ lưu metadata.returnData để audit — không finalize payment ở đây
        await Payment.findOneAndUpdate(
            { provider: "MOMO", transactionId: orderId },
            { $set: { "metadata.returnData": params } },
            { new: true }
        );

        if (success) {
            return res.send(
                `<h2>🎉 Giao dịch được xác nhận tạm thời</h2><p>Mã giao dịch: ${orderId}</p><p>Số tiền: ${amount}đ</p><p>Vui lòng chờ xác nhận chính thức (IPN).</p><a href="/">Về trang chủ</a>`
            );
        } else {
            return res.send(
                `<h2>❌ Thanh toán thất bại</h2><p>Lý do: ${message}</p><a href="/">Thử lại</a>`
            );
        }
    } catch (err) {
        console.error("momoReturn error:", err);
        return res.status(500).send("Internal error");
    }
};

/** ============ IPN ============ */
const momoIPN = async (req, res) => {
    try {
        const params = req.body || {};
        console.log("✅ MoMo IPN raw:", params);

        const { secretKey } = getMomoConfig();

        // verify signature
        if (!verifyMomoSignature(params, secretKey)) {
            console.warn("momoIPN: signature invalid", params);
            return res.status(400).json({ resultCode: 1, message: "Invalid signature" });
        }

        const { orderId, amount: amtRaw, resultCode, message, extraData } = params;

        // parse billId from extraData JSON
        let billId = null;
        try {
            const extra = extraData ? JSON.parse(extraData) : {};
            billId = extra.billId || extra?.bill_id || null;
        } catch {
            console.warn("momoIPN: extraData parse failed:", extraData);
        }

        // try find existing payment
        let payment = await Payment.findOne({ provider: "MOMO", transactionId: orderId });

        if (!payment) {
            if (!billId) {
                // create a minimal record for audit and return (won't apply)
                try {
                    await Payment.create({
                        provider: "MOMO",
                        transactionId: orderId,
                        amount: mongoose.Types.Decimal128.fromString(Number(amtRaw || 0).toFixed(2)),
                        status: Number(resultCode) === 0 ? "PENDING" : "FAILED",
                        method: "REDIRECT",
                        metadata: params,
                    });
                } catch (e) {
                    // ignore duplicate key race
                    if (e.code === 11000) {
                        console.warn("Duplicate payment race (missing billId) for", orderId);
                    } else {
                        console.error("Error creating minimal payment:", e);
                    }
                }
                return res.json({ resultCode: 0, message: "Missing billId — logged only" });
            }

            const amountNum = Number(amtRaw || 0);
            try {
                payment = await Payment.create({
                    billId,
                    provider: "MOMO",
                    transactionId: orderId,
                    amount: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
                    status: "PENDING",
                    method: "REDIRECT",
                    metadata: params,
                });
            } catch (e) {
                if (e.code === 11000) {
                    // duplicate created by race — try find again
                    payment = await Payment.findOne({ provider: "MOMO", transactionId: orderId });
                } else {
                    throw e;
                }
            }
        }

        // If still not found (very unlikely), log and return error
        if (!payment) {
            console.error("momoIPN: payment still not found after attempted create", orderId);
            return res.status(500).json({ resultCode: 99, message: "Payment record unavailable" });
        }

        // idempotency: if already applied, return success
        if (payment.status === "SUCCESS") {
            return res.json({ resultCode: 0, message: "Already processed" });
        }

        if (Number(resultCode) === 0) {
            // apply using shared helper (atomic)
            try {
                await applyPaymentToBill(payment, params);
                return res.json({ resultCode: 0, message: "Confirm Success" });
            } catch (e) {
                console.error("applyPaymentToBill error (MoMo IPN):", e);
                // internal error -> provider may retry
                return res.status(500).json({ resultCode: 99, message: "Internal error" });
            }
        } else {
            // mark failed
            try {
                payment.status = "FAILED";
                payment.metadata = params;
                await payment.save();
            } catch (e) {
                console.error("Failed to update payment status to FAILED:", e);
            }
            return res.json({ resultCode: resultCode || 1, message: message || "Payment failed" });
        }
    } catch (err) {
        console.error("momoIPN error:", err);
        return res.status(500).json({ resultCode: 99, message: err.message });
    }
};

export default { createPayment, momoReturn, momoIPN };
