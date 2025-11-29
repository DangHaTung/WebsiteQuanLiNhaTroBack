/**
 * Script để cập nhật các bills CONTRACT của FinalContract đã bị hủy (CANCELED)
 * Chạy script này để cập nhật dữ liệu cũ
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/nhatro";

async function fixCanceledFinalContractBills() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const FinalContract = (await import("../src/models/finalContract.model.js")).default;
    const Bill = (await import("../src/models/bill.model.js")).default;

    // Tìm tất cả FinalContract đã bị hủy
    const canceledFinalContracts = await FinalContract.find({ status: "CANCELED" });
    console.log(`📋 Tìm thấy ${canceledFinalContracts.length} FinalContract đã bị hủy`);

    let totalBillsUpdated = 0;

    for (const fc of canceledFinalContracts) {
      // Tìm tất cả bills CONTRACT của FinalContract này
      const bills = await Bill.find({
        finalContractId: fc._id,
        billType: "CONTRACT",
        status: { $ne: "VOID" } // Chỉ cập nhật bills chưa bị hủy
      });

      for (const bill of bills) {
        // Chỉ hủy nếu bill chưa thanh toán
        if (bill.status !== "PAID") {
          bill.status = "VOID";
          bill.note = bill.note 
            ? `${bill.note} [Đã hủy do hủy hợp đồng chính thức - cập nhật tự động]` 
            : "Đã hủy do hủy hợp đồng chính thức - cập nhật tự động";
          await bill.save();
          totalBillsUpdated++;
          console.log(`✅ Đã hủy bill ${bill._id} của FinalContract ${fc._id}`);
        } else {
          console.log(`⚠️ Bỏ qua bill ${bill._id} vì đã thanh toán`);
        }
      }
    }

    console.log(`\n✅ Hoàn thành! Đã cập nhật ${totalBillsUpdated} bills`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixCanceledFinalContractBills();

