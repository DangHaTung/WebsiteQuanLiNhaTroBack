import mongoose from "mongoose";
import UtilityFee from "../src/models/utilityFee.model.js";
import { calculateElectricityCost, DEFAULT_ELECTRICITY_TIERS } from "../src/services/utility/electricity.service.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function checkElectricityConfig() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Lấy config điện từ DB
    const elecConfig = await UtilityFee.findOne({ type: "electricity", isActive: true });
    
    console.log("\n📊 Electricity Config in DB:");
    if (elecConfig) {
      console.log("VAT:", elecConfig.vatPercent, "%");
      console.log("Tiers:", JSON.stringify(elecConfig.electricityTiers, null, 2));
    } else {
      console.log("❌ No electricity config found, using DEFAULT");
      console.log("Default tiers:", JSON.stringify(DEFAULT_ELECTRICITY_TIERS, null, 2));
    }

    // Test với 60 kWh
    console.log("\n🧪 Test calculation with 60 kWh:");
    const tiers = elecConfig?.electricityTiers?.length ? elecConfig.electricityTiers : DEFAULT_ELECTRICITY_TIERS;
    const vatPercent = typeof elecConfig?.vatPercent === "number" ? elecConfig.vatPercent : 8;
    const result = calculateElectricityCost(60, tiers, vatPercent);
    
    console.log("Items:", JSON.stringify(result.items, null, 2));
    console.log("Subtotal:", result.subtotal.toLocaleString("vi-VN"), "đ");
    console.log("VAT:", result.vat.toLocaleString("vi-VN"), "đ");
    console.log("Total:", result.total.toLocaleString("vi-VN"), "đ");

    // Test với 200 kWh
    console.log("\n🧪 Test calculation with 200 kWh:");
    const result200 = calculateElectricityCost(200, tiers, vatPercent);
    console.log("Total:", result200.total.toLocaleString("vi-VN"), "đ");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkElectricityConfig();
