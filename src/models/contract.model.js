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
    canceledAt: {
      type: Date,
    }, // Ngày hủy hợp đồng (nếu hủy trước hạn)
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
      damageAmount: { type: mongoose.Schema.Types.Decimal128 }, // Thiệt hại
      damageNote: { type: String }, // Ghi chú thiệt hại
      finalMonthServiceFee: { type: mongoose.Schema.Types.Decimal128 }, // Dịch vụ tháng cuối
      initialDeposit: { type: mongoose.Schema.Types.Decimal128 }, // Tiền cọc ban đầu (1 tháng tiền phòng) để hiển thị đúng
    },
    // Người ở cùng (co-tenants) - cho phép nhiều người ở chung phòng
    coTenants: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        fullName: { type: String },
        phone: { type: String },
        email: { type: String },
        identityNo: { type: String },
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date }, // Nếu rời phòng giữa chừng (giữ lại để tương thích)
        status: {
          type: String,
          enum: ["ACTIVE", "EXPIRED"],
          default: "ACTIVE",
        }, // Trạng thái: ACTIVE = đang hoạt động, EXPIRED = hết hiệu lực (khi hợp đồng hủy/hết hạn)
        finalContractId: { type: Schema.Types.ObjectId, ref: "FinalContract" },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Contract", contractSchema);
