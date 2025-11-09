import mongoose from "mongoose";

const { Schema } = mongoose;

// Supported utility fee types
export const FEE_TYPES = [
  "electricity",
  "water",
  "internet",
  "cleaning",
  "parking",
];

// Electricity tier schema for flexible configuration
const tierSchema = new Schema(
  {
    min: { type: Number, required: true }, // inclusive
    max: { type: Number, required: false }, // inclusive; omit for last tier
    rate: { type: Number, required: true }, // VND per kWh
  },
  { _id: false }
);

const utilityFeeSchema = new Schema(
  {
    type: {
      type: String,
      enum: FEE_TYPES,
      required: true,
      index: true,
    },
    description: { type: String, trim: true, default: "" },
    // Base rate used for non-tiered fees (e.g., water per m3, internet flat/month)
    baseRate: { type: Number, default: 0 },
    // Electricity-specific tier configuration; if empty, use default tiers in controller/service
    electricityTiers: { type: [tierSchema], default: [] },
    vatPercent: { type: Number, default: 8 }, // default VAT 8%
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: "utility_fees",
  }
);

// Ensure only one active config per fee type
utilityFeeSchema.index({ type: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.models.UtilityFee || mongoose.model("UtilityFee", utilityFeeSchema);