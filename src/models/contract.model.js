import mongoose from "mongoose";

const { Schema } = mongoose;

const contractSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      // Cho phép hợp đồng (biên lai) được tạo khi khách chưa có tài khoản
      required: false,
    },
    // Ảnh chụp thông tin người thuê tại thời điểm tạo biên lai/hợp đồng
    tenantSnapshot: {
      fullName: { type: String },
      phone: { type: String },
      email: { type: String },
      identityNo: { type: String },
      note: { type: String },
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    deposit: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    monthlyRent: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ENDED", "CANCELED"],
      default: "ACTIVE",
    },
    pricingSnapshot: {
      roomNumber: { type: String },
      monthlyRent: { type: mongoose.Schema.Types.Decimal128 },
      deposit: { type: mongoose.Schema.Types.Decimal128 },
    },
    // Hoàn cọc khi hợp đồng kết thúc (không gia hạn)
    depositRefunded: { type: Boolean, default: false },
    depositRefund: {
      amount: { type: mongoose.Schema.Types.Decimal128 },
      refundedAt: { type: Date },
      method: { type: String }, // BANK/CASH/OTHER
      transactionId: { type: String },
      note: { type: String },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Contract", contractSchema);
