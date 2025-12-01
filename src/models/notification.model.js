import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // Người nhận thông báo
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Loại thông báo
    type: {
      type: String,
      enum: [
        'BILL_CREATED',        // Tạo hóa đơn mới
        'BILL_DUE_SOON',       // Hóa đơn sắp đến hạn
        'PAYMENT_SUCCESS',     // Thanh toán thành công
        'PAYMENT_FAILED',      // Thanh toán thất bại
        'CONTRACT_SIGNED',     // Ký hợp đồng
        'CONTRACT_EXPIRING',   // Hợp đồng sắp hết hạn
        'RECEIPT_CREATED',     // Tạo phiếu thu
        'SYSTEM',              // Thông báo hệ thống
      ],
      required: true,
      index: true,
    },

    // Tiêu đề ngắn gọn
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Nội dung chi tiết
    message: {
      type: String,
      required: true,
    },

    // Đối tượng liên quan
    relatedEntity: {
      type: String,
      enum: ['BILL', 'CONTRACT', 'FINALCONTRACT', 'PAYMENT', 'ROOM', 'USER', 'SYSTEM'],
      required: false,
    },

    // ID của đối tượng liên quan
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    // Trạng thái đã đọc
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Thời gian đọc
    readAt: {
      type: Date,
      default: null,
    },

    // Metadata bổ sung (số tiền, số phòng, tháng, etc.)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Priority level
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },

    // Action URL (để navigate khi click)
    actionUrl: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes để tối ưu query
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

// Virtual để populate related entity
notificationSchema.virtual('relatedBill', {
  ref: 'Bill',
  localField: 'relatedEntityId',
  foreignField: '_id',
  justOne: true,
});

notificationSchema.virtual('relatedContract', {
  ref: 'FinalContract',
  localField: 'relatedEntityId',
  foreignField: '_id',
  justOne: true,
});

// Method: Đánh dấu đã đọc
notificationSchema.methods.markAsRead = async function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method: Đếm số thông báo chưa đọc
notificationSchema.statics.countUnread = function (userId) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method: Lấy thông báo chưa đọc
notificationSchema.statics.getUnread = function (userId, limit = 10) {
  return this.find({ userId, isRead: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'fullName email');
};

// Static method: Đánh dấu tất cả đã đọc
notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
