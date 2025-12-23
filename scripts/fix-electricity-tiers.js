import mongoose from "mongoose";
import UtilityFee from "../src/models/utilityFee.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

const CORRECT_TIERS = [
  { min: 0, max: 50, rate: 1984 },
  { min: 51, max: 100, rate: 2050 },
  { min: 101, max: 200, rate: 2380 },
  { min: 201, max: 300, rate: 2998 },
  { min: 301, max: 400, rate: 3350 },
  { min: 401, max: undefined, rate: 3460 },
];

async function fixElectricityTiers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const result = await UtilityFee.findOneAndUpdate(
      { type: "electricity", isActive: true },
      { 
        $set: { 
          electricityTiers: CORRECT_TIERS,
          vatPercent: 8
        } 
      },
      { new: true, upsert: true }
    );

    console.log("✅ Updated electricity tiers:");
    console.log(JSON.stringify(result.electricityTiers, null, 2));
    console.log("VAT:", result.vatPercent, "%");

    await mongoose.disconnect();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixElectricityTiers();
