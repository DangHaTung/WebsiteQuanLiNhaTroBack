import mongoose from "mongoose";
import dotenv from "dotenv";
import Bill from "../src/models/bill.model.js";
import { autoCreateAccountAfterPayment } from "../src/controllers/publicPayment.controller.js";

dotenv.config();

async function testAutoCreateAccount() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get latest PAID RECEIPT bill
    const bill = await Bill.findOne({ 
      billType: "RECEIPT",
      status: "PAID"
    })
    .sort({ updatedAt: -1 })
    .populate("contractId");

    if (!bill) {
      console.log("❌ No PAID RECEIPT bill found");
      process.exit(0);
    }

    console.log("📋 Testing with bill:", bill._id.toString());
    console.log("Bill Type:", bill.billType);
    console.log("Bill Status:", bill.status);
    console.log("Contract ID:", bill.contractId?._id);
    
    if (bill.contractId) {
      console.log("Contract tenantId:", bill.contractId.tenantId);
      console.log("Contract tenantSnapshot:", bill.contractId.tenantSnapshot);
    }

    console.log("\n🔄 Calling autoCreateAccountAfterPayment...\n");
    
    await autoCreateAccountAfterPayment(bill);
    
    console.log("\n✅ Done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testAutoCreateAccount();
