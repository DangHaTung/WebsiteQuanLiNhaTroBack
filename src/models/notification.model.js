import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientRole: {
      type: String,
      enum: ["ADMIN", "USER", "TENANT"],
      required: true,
    },
    type: {
      type: String,
      enum: ["COMPLAINT_NEW", "BILL_NEW", "CONTRACT_NEW", "PAYMENT_SUCCESS", "SYSTEM"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      refPath: "relatedEntityType",
    },
    relatedEntityType: {
      type: String,
      enum: ["Complaint", "Bill", "Contract", null],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;



