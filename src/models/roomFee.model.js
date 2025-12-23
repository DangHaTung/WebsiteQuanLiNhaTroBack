import mongoose from "mongoose";

const { Schema } = mongoose;

const roomFeeSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    // Which fees are applied to this room
    appliedTypes: {
      type: [String],
      enum: ["electricity", "water", "internet", "cleaning", "parking"],
      default: [],
    },
    // Optional snapshot identifiers to the active UtilityFee configs at time of assignment
    feeRefs: {
      electricity: { type: Schema.Types.ObjectId, ref: "UtilityFee" },
      water: { type: Schema.Types.ObjectId, ref: "UtilityFee" },
      internet: { type: Schema.Types.ObjectId, ref: "UtilityFee" },
      cleaning: { type: Schema.Types.ObjectId, ref: "UtilityFee" },
      parking: { type: Schema.Types.ObjectId, ref: "UtilityFee" },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: true }, collection: "room_fees" }
);

roomFeeSchema.index({ roomId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.models.RoomFee || mongoose.model("RoomFee", roomFeeSchema);