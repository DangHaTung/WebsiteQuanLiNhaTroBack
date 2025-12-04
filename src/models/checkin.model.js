import mongoose from "mongoose";

const { Schema } = mongoose;

// Schema cho file (ảnh, tài liệu, v.v.)
const fileSchema = new Schema(
  {
    url: { type: String },
    secure_url: { type: String },
    public_id: { type: String },
    resource_type: { type: String },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false } // Không tạo _id riêng cho subdocument này
);

// Schema chính cho Checkin
const checkinSchema = new Schema(
  {
    // Optional liên kết tới User nếu có tài khoản
    tenantId: { type: Schema.Types.ObjectId, ref: "User" },
    // User thực hiện check-in (bắt buộc)
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Phòng được check-in (bắt buộc)
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    // Hợp đồng tạm hoặc chính thức liên quan (nếu đã tạo)
    contractId: { type: Schema.Types.ObjectId, ref: "Contract" },
    finalContractId: { type: Schema.Types.ObjectId, ref: "FinalContract" },

    // Liên kết tới phiếu thu tiền mặt (RECEIPT)
    receiptBillId: { type: Schema.Types.ObjectId, ref: "Bill" },

    // Ngày bắt đầu check-in
    checkinDate: { type: Date, required: true },

    // Thời gian thuê theo tháng
    durationMonths: { type: Number, required: true },

    // Tiền cọc & giá thuê hàng tháng
    deposit: { type: mongoose.Schema.Types.Decimal128 },
    monthlyRent: { type: mongoose.Schema.Types.Decimal128 },

    // Thông tin tenant tại thời điểm check-in (snapshot)
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

    // Ghi chú chung
    notes: { type: String },
    attachments: [fileSchema],

    // Bỏ cờ scan phiếu thu/hợp đồng mẫu (receipt/sample) theo nghiệp vụ mới

    // Trạng thái check-in
    status: { type: String, enum: ["CREATED", "COMPLETED", "CANCELED"], default: "CREATED" },

    // Xử lý tiền cọc khi hủy: FORFEIT (mất cọc), APPLIED (áp vào quyết toán), REFUNDED (hoàn cọc)
    depositDisposition: { type: String, enum: ["FORFEIT", "APPLIED", "REFUNDED"], default: undefined },

    // Thời điểm thanh toán phiếu thu (để tính thời hạn 3 ngày)
    receiptPaidAt: { type: Date },

    // Số điện chốt ban đầu khi check-in (để tính số điện tiêu thụ cho hóa đơn hàng tháng)
    initialElectricReading: { type: Number },

    // Danh sách xe của khách thuê (lưu 1 lần khi check-in, tự động áp dụng cho hóa đơn hàng tháng)
    vehicles: [{
      type: { 
        type: String, 
        enum: ['motorbike', 'electric_bike', 'bicycle'], 
        required: true 
      },
      licensePlate: { type: String }, // Biển số xe (optional cho xe đạp)
    }],
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export default mongoose.model("Checkin", checkinSchema);