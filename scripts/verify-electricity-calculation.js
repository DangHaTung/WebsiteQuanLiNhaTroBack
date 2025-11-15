import mongoose from "mongoose";
import UtilityFee from "../src/models/utilityFee.model.js";
import { calculateElectricityCost } from "../src/services/utility/electricity.service.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

// Tính thủ công để so sánh
function manualCalculation(kwh, tiers, vatPercent) {
  console.log(`\n🧮 Tính thủ công cho ${kwh} kWh:`);
  let remaining = kwh;
  let subtotal = 0;
  const breakdown = [];

  tiers.forEach((tier, idx) => {
    if (remaining <= 0) return;
    
    // Tính số kWh trong bậc này
    const tierMin = tier.min;
    const tierMax = tier.max || Infinity;
    // Bậc 1 (0-50): có 50 kWh (từ kWh thứ 1 đến 50)
    // Bậc 2 (51-100): có 50 kWh (từ kWh thứ 51 đến 100)
    const tierCapacity = tierMax === Infinity 
      ? Infinity 
      : (tierMin === 0 ? tierMax : tierMax - tierMin + 1);
    const used = Math.min(remaining, tierCapacity);
    const amount = used * tier.rate;
    
    breakdown.push({
      tier: idx + 1,
      range: `${tierMin}-${tierMax === Infinity ? '∞' : tierMax}`,
      capacity: tierCapacity === Infinity ? '∞' : tierCapacity,
      used: used,
      rate: tier.rate,
      amount: amount
    });
    
    console.log(`  Bậc ${idx + 1} (${tierMin}-${tierMax === Infinity ? '∞' : tierMax} kWh):`);
    console.log(`    - Sức chứa bậc: ${tierCapacity === Infinity ? '∞' : tierCapacity} kWh`);
    console.log(`    - Dùng: ${used} kWh × ${tier.rate} đ/kWh = ${amount.toLocaleString('vi-VN')} đ`);
    
    subtotal += amount;
    remaining -= used;
  });

  const vat = Math.round((subtotal * vatPercent) / 100);
  const total = subtotal + vat;

  console.log(`  Subtotal: ${subtotal.toLocaleString('vi-VN')} đ`);
  console.log(`  VAT ${vatPercent}%: ${vat.toLocaleString('vi-VN')} đ`);
  console.log(`  Total: ${total.toLocaleString('vi-VN')} đ`);

  return { breakdown, subtotal, vat, total };
}

async function verifyCalculation() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const elecConfig = await UtilityFee.findOne({ type: "electricity", isActive: true });
    const tiers = elecConfig?.electricityTiers || [];
    const vatPercent = elecConfig?.vatPercent || 8;

    console.log("\n📊 Cấu hình bậc thang điện:");
    tiers.forEach((tier, i) => {
      const capacity = tier.max ? tier.max - tier.min + 1 : '∞';
      console.log(`Bậc ${i + 1}: ${tier.min}-${tier.max || '∞'} kWh (${capacity} kWh) = ${tier.rate.toLocaleString('vi-VN')} đ/kWh`);
    });
    console.log(`VAT: ${vatPercent}%`);

    // Test cases
    const testCases = [50, 100, 200, 300, 400, 500];

    for (const kwh of testCases) {
      console.log("\n" + "=".repeat(80));
      console.log(`TEST: ${kwh} kWh`);
      console.log("=".repeat(80));

      // Tính bằng function
      const funcResult = calculateElectricityCost(kwh, tiers, vatPercent);
      console.log("\n📱 Kết quả từ function:");
      funcResult.items.forEach(item => {
        console.log(`  Bậc ${item.tier}: ${item.kwh} kWh × ${item.rate} = ${item.amount.toLocaleString('vi-VN')} đ`);
      });
      console.log(`  Subtotal: ${funcResult.subtotal.toLocaleString('vi-VN')} đ`);
      console.log(`  VAT: ${funcResult.vat.toLocaleString('vi-VN')} đ`);
      console.log(`  Total: ${funcResult.total.toLocaleString('vi-VN')} đ`);

      // Tính thủ công
      const manualResult = manualCalculation(kwh, tiers, vatPercent);

      // So sánh
      console.log("\n🔍 So sánh:");
      const match = funcResult.total === manualResult.total;
      if (match) {
        console.log(`  ✅ ĐÚNG - Cả 2 cách tính giống nhau: ${funcResult.total.toLocaleString('vi-VN')} đ`);
      } else {
        console.log(`  ❌ SAI - Function: ${funcResult.total.toLocaleString('vi-VN')} đ vs Manual: ${manualResult.total.toLocaleString('vi-VN')} đ`);
        console.log(`  Chênh lệch: ${Math.abs(funcResult.total - manualResult.total).toLocaleString('vi-VN')} đ`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyCalculation();
