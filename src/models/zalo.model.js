// src/models/demoPayment.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

// Giá trị mặc định 0 cho amount
const decimalZero = mongoose.Types.Decimal128.fromString("0");

const demoPaymentSchema = new Schema(
  {
    orderId: { type: String, required: true, index: true }, // id giả lập cho demo
    provider: {
      type: String,
      enum: ["DEMO_PAY", "FAKE_WALLET", "FUNBANK"],
      required: true,
    },
    transactionId: { type: String }, // mã giao dịch giả lập
    amount: { type: Schema.Types.Decimal128, required: true, default: decimalZero },
    currency: { type: String, default: "VND" },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
    method: { type: String }, // ví dụ: REDIRECT, QR_CODE
    metadata: { type: Schema.Types.Mixed }, // lưu thông tin raw, callback, response demo
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ngăn duplicate: provider + transactionId phải unique nếu transactionId tồn tại
demoPaymentSchema.index({ provider: 1, transactionId: 1 }, { unique: true, sparse: true });

// Chuyển Decimal128 sang string khi trả về JSON
demoPaymentSchema.set("toJSON", {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.model("DemoPayment", demoPaymentSchema);
