import mongoose from "mongoose";
import dotenv from "dotenv";
import Bill from "../src/models/bill.model.js";
import Contract from "../src/models/contract.model.js";

dotenv.config();

async function listPaymentLinks() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const bills = await Bill.find({
      billType: "RECEIPT",
      paymentToken: { $exists: true, $ne: null }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("contractId");

    if (bills.length === 0) {
      console.log("❌ No bills with payment token found");
      process.exit(0);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    console.log(`Found ${bills.length} bills with payment links:\n`);

    for (const bill of bills) {
      const contract = bill.contractId;
      const paymentUrl = `${frontendUrl}/public/payment/${bill._id}/${bill.paymentToken}`;
      
      console.log("━".repeat(80));
      console.log(`📋 Bill ID: ${bill._id}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Amount Due: ${bill.amountDue.toString()}`);
      console.log(`   Amount Paid: ${bill.amountPaid.toString()}`);
      console.log(`   Tenant: ${contract?.tenantSnapshot?.fullName || "N/A"}`);
      console.log(`   Email: ${contract?.tenantSnapshot?.email || "N/A"}`);
      console.log(`   Token Expires: ${bill.paymentTokenExpires}`);
      console.log(`   🔗 Link: ${paymentUrl}`);
      console.log();
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

listPaymentLinks();
