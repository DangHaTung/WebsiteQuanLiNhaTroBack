import mongoose from "mongoose";

const { Schema } = mongoose;

const fileSchema = new Schema(
  {
    url: { type: String },
    secure_url: { type: String },
    public_id: { type: String },
    resource_type: { type: String },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false }
);

const checkinSchema = new Schema(
  {
    // Optional liên kết tới User nếu có tài khoản
    tenantId: { type: Schema.Types.ObjectId, ref: "User" },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    contractId: { type: Schema.Types.ObjectId, ref: "Contract" },
    finalContractId: { type: Schema.Types.ObjectId, ref: "FinalContract" },

    // Liên kết tới bill phiếu thu (RECEIPT)
    receiptBillId: { type: Schema.Types.ObjectId, ref: "Bill" },

    checkinDate: { type: Date, required: true },
    durationMonths: { type: Number, required: true },

    deposit: { type: mongoose.Schema.Types.Decimal128 },
    monthlyRent: { type: mongoose.Schema.Types.Decimal128 },

    // Ảnh chụp thông tin người thuê tại thời điểm check-in (không cần tài khoản)
    tenantSnapshot: {
      fullName: { type: String },
      phone: { type: String },
      email: { type: String },
      identityNo: { type: String },
      address: { type: String },
      note: { type: String },
    },

    // Ảnh CCCD/CMND
    cccdImages: {
      front: fileSchema, // Ảnh mặt trước
      back: fileSchema,  // Ảnh mặt sau
    },

    notes: { type: String },
    attachments: [fileSchema],

    // Bỏ cờ scan phiếu thu/hợp đồng mẫu (receipt/sample) theo nghiệp vụ mới

    // Trạng thái check-in
    status: { type: String, enum: ["CREATED", "COMPLETED", "CANCELED"], default: "CREATED" },

    // Xử lý tiền cọc khi hủy: FORFEIT (mất cọc), APPLIED (áp vào quyết toán), REFUNDED (hoàn cọc)
    depositDisposition: { type: String, enum: ["FORFEIT", "APPLIED", "REFUNDED"], default: undefined },

    // Thời điểm thanh toán phiếu thu (để tính thời hạn 3 ngày)
    receiptPaidAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export default mongoose.model("Checkin", checkinSchema);