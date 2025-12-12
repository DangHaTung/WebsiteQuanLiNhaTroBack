import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Import Bill model
const Bill = (await import("../src/models/bill.model.js")).default;

const toDec = (n) => mongoose.Types.Decimal128.fromString(Number(n).toFixed(2));

async function fixContractBillAmountPaid() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI or MONGO_URI not found in .env");
    }
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Tìm tất cả CONTRACT bills đã thanh toán
    const contractBills = await Bill.find({
      billType: "CONTRACT",
      status: "PAID"
    });

    console.log(`\n📋 Found ${contractBills.length} PAID CONTRACT bills`);

    for (const bill of contractBills) {
      const oldAmountPaid = Number(bill.amountPaid?.toString() || 0);
      const amountDue = Number(bill.amountDue?.toString() || 0);

      // Với CONTRACT bill: amountPaid phải = amountDue (nếu đã thanh toán)
      // KHÔNG lấy từ payments vì có thể chứa payment từ RECEIPT bill
      let correctAmountPaid = 0;
      
      if (bill.status === "PAID") {
        // Nếu đã thanh toán, amountPaid = amountDue
        correctAmountPaid = amountDue;
      } else if (bill.status === "PARTIALLY_PAID") {
        // Nếu thanh toán một phần, tính từ payments
        if (bill.payments && bill.payments.length > 0) {
          correctAmountPaid = bill.payments.reduce((sum, p) => {
            return sum + Number(p.amount?.toString() || 0);
          }, 0);
        }
      }

      console.log(`\n📄 Bill ${bill._id}:`);
      console.log(`   Old amountPaid: ${oldAmountPaid.toLocaleString("vi-VN")}`);
      console.log(`   Correct amountPaid: ${correctAmountPaid.toLocaleString("vi-VN")}`);
      console.log(`   amountDue: ${amountDue.toLocaleString("vi-VN")}`);

      if (oldAmountPaid !== correctAmountPaid) {
        bill.amountPaid = toDec(correctAmountPaid);
        await bill.save();
        console.log(`   ✅ Updated amountPaid to ${correctAmountPaid.toLocaleString("vi-VN")}`);
      } else {
        console.log(`   ✓ amountPaid is correct`);
      }
    }

    console.log("\n✅ Done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixContractBillAmountPaid();
