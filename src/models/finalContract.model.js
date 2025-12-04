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

const finalContractSchema = new Schema(
  {
    // Cho phép tạo FinalContract khi chưa có tài khoản người thuê; gán sau
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    originContractId: { type: Schema.Types.ObjectId, ref: "Contract" },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    deposit: { type: mongoose.Schema.Types.Decimal128, required: true },
    monthlyRent: { type: mongoose.Schema.Types.Decimal128, required: true },

    pricingSnapshot: {
      roomNumber: { type: String },
      monthlyRent: { type: mongoose.Schema.Types.Decimal128 },
      deposit: { type: mongoose.Schema.Types.Decimal128 },
    },

    terms: { type: String },

    status: {
      type: String,
      enum: ["DRAFT", "WAITING_SIGN", "SIGNED", "CANCELED"],
      default: "DRAFT",
    },
    canceledAt: {
      type: Date,
    }, // Ngày hủy hợp đồng (nếu hủy trước hạn)

    // Uploads
    images: [fileSchema],
    cccdFiles: [fileSchema],

    // Signature tracking
    tenantSignedAt: { type: Date },
    ownerApprovedAt: { type: Date },
    finalizedAt: { type: Date },

    // Co-tenant support - cho phép tạo FinalContract cho người ở cùng
    linkedContractId: { type: Schema.Types.ObjectId, ref: "Contract" }, // Link đến Contract chính
    isCoTenant: { type: Boolean, default: false }, // Flag để biết đây là FinalContract cho người ở cùng

    // Metadata để lưu thông tin linh hoạt (ví dụ: lịch sử gia hạn)
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("FinalContract", finalContractSchema);