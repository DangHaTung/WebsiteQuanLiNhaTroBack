import mongoose from "mongoose";

const { Schema } = mongoose;

const moveOutRequestSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: "Contract", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    requestedAt: { type: Date, default: Date.now },
    moveOutDate: { type: Date, required: true }, // Ngày dự kiến chuyển đi
    reason: { type: String, required: true, trim: true, maxLength: 500 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "WAITING_CONFIRMATION", "COMPLETED"],
      default: "PENDING",
    },
    adminNote: { type: String, trim: true, maxLength: 500 },
    processedBy: { type: Schema.Types.ObjectId, ref: "User" }, // Admin/Staff xử lý
    processedAt: { type: Date },
    refundProcessed: { type: Boolean, default: false }, // Đánh dấu đã hoàn cọc
    refundedAt: { type: Date }, // Thời gian admin hoàn cọc (để tính 3 ngày tự động confirm)
    refundConfirmed: { type: Boolean, default: false }, // Đánh dấu client đã xác nhận nhận được tiền
    refundConfirmedAt: { type: Date }, // Thời gian client xác nhận
    refundQrCode: {
      url: { type: String },
      secure_url: { type: String },
      public_id: { type: String },
      resource_type: { type: String },
    }, // QR code nhận tiền hoàn cọc (optional)
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("MoveOutRequest", moveOutRequestSchema);

