import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkBill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Bill = (await import("../src/models/bill.model.js")).default;
    
    const billId = "6918a0445d7480e7bc97128d";
    const bill = await Bill.findById(billId).lean();
    
    if (!bill) {
      console.log("❌ Bill not found");
      return;
    }

    console.log("\n📋 Bill details:");
    console.log(`   ID: ${bill._id}`);
    console.log(`   Type: ${bill.billType}`);
    console.log(`   Status: ${bill.status}`);
    console.log(`   Amount Due: ${bill.amountDue}`);
    console.log(`   Amount Paid: ${bill.amountPaid}`);
    console.log(`   Contract ID: ${bill.contractId}`);
    console.log(`   Final Contract ID: ${bill.finalContractId}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

checkBill();
