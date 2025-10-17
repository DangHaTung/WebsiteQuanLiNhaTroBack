import crypto from "crypto";
import https from "https";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";
import Contract from "../models/contract.model.js";
import Room from "../models/room.model.js";
import Tenant from "../models/tenant.model.js";

/**
 * Momo Controller — bản ổn định & đúng chuẩn test sandbox
 * - Fix tenant logic
 * - Fix orderInfo blank / format error
 * - Fix amount validation
 */

const getMomoConfig = () => ({
    accessKey: process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85",
    secretKey: process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
    redirectUrl: process.env.MOMO_RETURN_URL || "http://localhost:3000/api/payment/momo/return",
    ipnUrl: process.env.MOMO_IPN_URL || "http://localhost:3000/api/payment/momo/ipn",
});

/** Verify MoMo HMAC SHA256 signature */
function verifyMomoSignature(body, secretKey) {
    if (!body || !body.signature) return false;
    const signature = body.signature;
    const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";

    // Xây đúng thứ tự ký mà MoMo sử dụng
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
        const { billId, amount, orderInfo = "" } = req.body;
        if (!billId || !amount)
            return res.status(400).json({ success: false, message: "Thiếu billId hoặc amount" });

        // validate bill
        const bill = await Bill.findById(billId).lean();
        if (!bill) return res.status(404).json({ success: false, message: "Bill không tồn tại" });
        if (bill.status === "PAID")
            return res.status(400).json({ success: false, message: "Bill đã được thanh toán" });

        // validate chain: contract -> room -> tenant
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

        // build momo request
        const { accessKey, secretKey, partnerCode, redirectUrl, ipnUrl } = getMomoConfig();
        const requestType = "payWithMethod";
        const orderId = partnerCode + new Date().getTime();
        const requestId = orderId;
        const extraData = JSON.stringify({ billId });
        const autoCapture = true;
        const lang = "vi";

        // ✅ Đảm bảo orderInfo hợp lệ
        const orderInfoValue = (orderInfo && orderInfo.trim().length > 0
            ? orderInfo.trim()
            : `Thanh toán hóa đơn ${billId}`
        ).slice(0, 500);

        // tạo signature
        const rawSignature =
            "accessKey=" + accessKey +
            "&amount=" + amount +
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
            amount,
            orderId,
            orderInfo: orderInfoValue,
            redirectUrl,
            ipnUrl,
            lang,
            requestType,
            autoCapture,
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

                    await Payment.create({
                        billId,
                        provider: "MOMO",
                        transactionId: orderId,
                        amount,
                        status: result.resultCode === 0 ? "SUCCESS" : "PENDING",
                        method: "REDIRECT",
                        metadata: result,
                    }).catch(() => { });

                    return res.json({ success: true, data: result, payUrl: result.payUrl });
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

/** ============ RETURN ============ */
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

        await Payment.findOneAndUpdate(
            { provider: "MOMO", transactionId: orderId },
            {
                status: success ? "SUCCESS" : "FAILED",
                "metadata.returnData": params,
            },
            { new: true }
        );

        if (success) {
            res.send(
                `<h2>🎉 Thanh toán thành công!</h2><p>Mã giao dịch: ${orderId}</p><p>Số tiền: ${amount}đ</p><a href="/">Về trang chủ</a>`
            );
        } else {
            res.send(
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
        let billId = null;
        try {
            const extra = extraData ? JSON.parse(extraData) : {};
            billId = extra.billId || extra?.bill_id || null;
        } catch {
            console.warn("momoIPN: extraData parse failed:", extraData);
        }

        if (!billId) {
            await Payment.findOneAndUpdate(
                { provider: "MOMO", transactionId: orderId },
                {
                    status: Number(resultCode) === 0 ? "SUCCESS" : "FAILED",
                    amount: amtRaw,
                    method: "REDIRECT",
                    metadata: params,
                },
                { upsert: true, new: true }
            );
            return res.json({ resultCode: 0, message: "Missing billId, logged only" });
        }

        const bill = await Bill.findById(billId).lean();
        if (!bill) {
            await Payment.findOneAndUpdate(
                { provider: "MOMO", transactionId: orderId },
                {
                    billId,
                    status: Number(resultCode) === 0 ? "SUCCESS" : "FAILED",
                    amount: amtRaw,
                    method: "REDIRECT",
                    metadata: params,
                },
                { upsert: true, new: true }
            );
            return res.status(404).json({ resultCode: 2, message: "Bill not found" });
        }

        // idempotent
        const existing = await Payment.findOne({ provider: "MOMO", transactionId: orderId }).lean();
        if (existing && existing.status === "SUCCESS")
            return res.json({ resultCode: 0, message: "Already processed" });

        await Payment.findOneAndUpdate(
            { provider: "MOMO", transactionId: orderId },
            {
                billId,
                status: Number(resultCode) === 0 ? "SUCCESS" : "FAILED",
                amount: amtRaw,
                method: "REDIRECT",
                metadata: params,
            },
            { upsert: true, new: true }
        );

        if (Number(resultCode) === 0) {
            await Bill.findByIdAndUpdate(billId, {
                status: "PAID",
                $push: {
                    payments: {
                        paidAt: new Date(),
                        amount: amtRaw,
                        method: "MOMO",
                        provider: "MoMo",
                        transactionId: orderId,
                        note: message,
                        metadata: params,
                    },
                },
            });
            console.log(`💰 Bill ${billId} updated → PAID`);
        }

        return res.json({ resultCode: 0, message: "Confirm Success" });
    } catch (err) {
        console.error("momoIPN error:", err);
        return res.status(500).json({ resultCode: 99, message: err.message });
    }
};

export default { createPayment, momoReturn, momoIPN };
