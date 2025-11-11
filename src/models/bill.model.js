import mongoose from "mongoose";

const { Schema } = mongoose;

const billSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: "Contract", required: true },
    billingDate: { type: Date, required: true },

    // Phân loại bill theo nghiệp vụ
    billType: {
      type: String,
      enum: ["RECEIPT", "CONTRACT", "MONTHLY"],
      default: "MONTHLY",
    },

    status: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID", "VOID", "PENDING_CASH_CONFIRM"],
      default: "UNPAID",
    },

    lineItems: [
      {
        item: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Schema.Types.Decimal128, required: true },
        lineTotal: { type: Schema.Types.Decimal128, required: true },
      },
    ],

    amountDue: { type: Schema.Types.Decimal128, required: true },
    amountPaid: { type: Schema.Types.Decimal128, default: 0 },

   payments: [
  {
    paidAt: { type: Date },
    amount: { type: Schema.Types.Decimal128 },
    method: { 
      type: String, 
      enum: ["CASH", "BANK", "MOMO", "VNPAY", "ZALOPAY", "OTHER", "REDIRECT"], 
      default: "OTHER" 
    },
    provider: { type: String },
    transactionId: { type: String },
    note: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
],

    note: { type: String },

   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Tự động cập nhật thời gian
billSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Bill", billSchema);
