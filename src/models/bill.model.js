import mongoose from "mongoose";

const { Schema } = mongoose;

// Schema cho thông tin xe
const vehicleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["motorbike", "electric_bike", "bicycle"],
      required: true,
    },
    licensePlate: {
      type: String,
      trim: true,
      // Bắt buộc với xe máy và xe điện, không cần với xe đạp
    },
  },
  { _id: false }
);

const billSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: "Contract", required: true },
    finalContractId: { type: Schema.Types.ObjectId, ref: "FinalContract" }, // Link to FinalContract if applicable
    tenantId: { type: Schema.Types.ObjectId, ref: "User" }, // Link to User account (for RECEIPT bills)
    billingDate: { type: Date, required: true },
    
    // Thông tin xe chi tiết (thay thế vehicleCount đơn giản)
    vehicles: { type: [vehicleSchema], default: [] },

    // Thông tin số điện (để hiển thị chi tiết trong hóa đơn)
    electricityReading: {
      previous: { type: Number }, // Số điện cũ (kỳ trước)
      current: { type: Number },  // Số điện mới (kỳ này)
      consumption: { type: Number }, // Số điện tiêu thụ = current - previous
    },

    // Phân loại bill theo nghiệp vụ
    billType: {
      type: String,
      enum: ["RECEIPT", "CONTRACT", "MONTHLY"],
      default: "MONTHLY",
    },

    status: {
      type: String,
      enum: ["DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID", "VOID", "PENDING_CASH_CONFIRM"],
      default: "UNPAID",
    },

    // Payment token for public payment link (guest checkout)
    paymentToken: { type: String, unique: true, sparse: true },
    paymentTokenExpires: { type: Date },

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

    // Payment token for public payment link
    paymentToken: { type: String, index: true },
    paymentTokenExpiresAt: { type: Date },

    // Metadata để lưu thông tin bổ sung (ví dụ: ảnh bill chuyển khoản)
    metadata: { type: Schema.Types.Mixed },

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
