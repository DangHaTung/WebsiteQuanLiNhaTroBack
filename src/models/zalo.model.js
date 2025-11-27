// src/models/demoPayment.model.js

import mongoose from "mongoose";
const { Schema } = mongoose;

// ==============================
// Giá trị mặc định cho amount
// ==============================
// Sử dụng Decimal128 để lưu tiền chính xác (tránh sai số float)
const decimalZero = mongoose.Types.Decimal128.fromString("0");

// ==============================
// Demo Payment Schema
// ==============================
const demoPaymentSchema = new Schema(
  {
    // Id đơn hàng demo (giống billId nhưng không liên kết database thật)
    orderId: { type: String, required: true, index: true },

    // Provider demo: các giá trị enum để phân biệt nguồn thanh toán
    provider: {
      type: String,
      enum: ["DEMO_PAY", "FAKE_WALLET", "FUNBANK"], // chỉ cho phép các giá trị này
      required: true,
    },

    // Transaction ID của provider (giả lập)
    transactionId: { type: String },

    // Số tiền thanh toán
    amount: { type: Schema.Types.Decimal128, required: true, default: decimalZero },

    // Tiền tệ (mặc định VND)
    currency: { type: String, default: "VND" },

    // Trạng thái thanh toán
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },

    // Phương thức thanh toán (ví dụ: REDIRECT, QR_CODE)
    method: { type: String },

    // Metadata: lưu raw data, callback, response từ provider demo
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,       // Tự động tạo createdAt, updatedAt
    versionKey: false,      // Không tạo __v
    toJSON: { virtuals: true },   // Virtual fields có xuất khi toJSON
    toObject: { virtuals: true }, // Virtual fields có xuất khi toObject
  }
);

// ==============================
// Ngăn duplicate
// ==============================
// provider + transactionId phải unique nếu transactionId tồn tại
// sparse: true => chỉ áp dụng cho document có transactionId
demoPaymentSchema.index({ provider: 1, transactionId: 1 }, { unique: true, sparse: true });

// ==============================
// Convert Decimal128 sang string khi trả về JSON
// ==============================
// Mục đích: tránh trả về object Decimal128 trực tiếp
demoPaymentSchema.set("toJSON", {
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = ret.amount.toString();
    return ret;
  },
});

// ==============================
// Export model demo
// ==============================
export default mongoose.model("DemoPayment", demoPaymentSchema);
