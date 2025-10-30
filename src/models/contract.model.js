import mongoose from "mongoose";

const { Schema } = mongoose;

const contractSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Contract", contractSchema);
