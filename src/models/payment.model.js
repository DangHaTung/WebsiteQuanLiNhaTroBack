// src/models/payment.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const decimalZero = mongoose.Types.Decimal128.fromString("0");

const paymentSchema = new Schema(
    {
        billId: { type: Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
        provider: { type: String, enum: ["VNPAY", "MOMO", "ZALOPAY", "BANK", "OTHER"], required: true },
        transactionId: { type: String }, // mã giao dịch của provider (vnp_TxnRef, momo_orderId...)
        amount: { type: Schema.Types.Decimal128, required: true, default: decimalZero },
        currency: { type: String, default: "VND" },
        status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
        method: { type: String }, // ví dụ: QR_CODE, REDIRECT, WALLET, BANK_TRANSFER...
        metadata: { type: Schema.Types.Mixed }, // store raw callback, request body, provider response
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Prevent duplicates: provider + transactionId should be unique when transactionId exists
paymentSchema.index({ provider: 1, transactionId: 1 }, { unique: true, sparse: true });

// Return amount as string (avoid Decimal128 object in API)
paymentSchema.set("toJSON", {
    transform: (doc, ret) => {
        if (ret.amount) ret.amount = ret.amount.toString();
        return ret;
    },
});

export default mongoose.model("Payment", paymentSchema);
