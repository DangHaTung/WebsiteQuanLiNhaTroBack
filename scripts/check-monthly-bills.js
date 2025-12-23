import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkMonthlyBills() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Bill = (await import("../src/models/bill.model.js")).default;
    
    const contractId = "6918a1e5e8fdc9aa4daf3612";
    
    const monthlyBills = await Bill.find({ 
      contractId,
      billType: "MONTHLY" 
    }).lean();
    
    console.log(`\n📋 Found ${monthlyBills.length} MONTHLY bills for contract ${contractId}:`);
    
    for (const bill of monthlyBills) {
      console.log(`\n   Bill ID: ${bill._id}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Billing Date: ${bill.billingDate}`);
      console.log(`   Amount: ${bill.amountDue}`);
    }
    
    console.log(`\n🔧 NODE_ENV: ${process.env.NODE_ENV || "not set (defaults to development)"}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

checkMonthlyBills();
