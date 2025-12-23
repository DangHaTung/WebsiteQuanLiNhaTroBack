import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function createDraftBill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const { createMonthlyBillForRoom } = await import("../src/services/billing/monthlyBill.service.js");
    
    const contractId = "6918a1e5e8fdc9aa4daf3612";
    
    console.log("\n📝 Creating draft bill...");
    
    const result = await createMonthlyBillForRoom({
      contractId,
      electricityKwh: 0, // 0 = DRAFT
      waterM3: 0,
      occupantCount: 1,
      billingDate: new Date(),
      note: "Test draft bill",
    });
    
    console.log("\n✅ Draft bill created successfully!");
    console.log(`   Bill ID: ${result.bill._id}`);
    console.log(`   Status: ${result.bill.status}`);
    console.log(`   Room: ${result.room.roomNumber}`);
    console.log(`   Tenant: ${result.tenant?.fullName || "N/A"}`);
    console.log(`   Amount: ${result.bill.amountDue}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

createDraftBill();
