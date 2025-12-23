// Script để debug ZaloPay payment status
// Usage: node scripts/debug-zalopay-payment.js [transactionId]

import mongoose from "mongoose";
import Payment from "../src/models/payment.model.js";
import Bill from "../src/models/bill.model.js";

const transactionId = process.argv[2];

if (!transactionId) {
  console.log("Usage: node scripts/debug-zalopay-payment.js <transactionId>");
  console.log("Example: node scripts/debug-zalopay-payment.js 251126_123456");
  process.exit(1);
}

async function debugPayment() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/your-db";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Find payment
    const payment = await Payment.findOne({
      provider: "ZALOPAY",
      transactionId: transactionId
    }).populate("billId");

    if (!payment) {
      console.log(`❌ Payment not found with transactionId: ${transactionId}`);
      process.exit(1);
    }

    console.log("\n📦 Payment Info:");
    console.log("==================");
    console.log("Transaction ID:", payment.transactionId);
    console.log("Status:", payment.status);
    console.log("Amount:", payment.amount.toString());
    console.log("Created At:", payment.createdAt);
    console.log("Updated At:", payment.updatedAt);
    console.log("Metadata:", JSON.stringify(payment.metadata, null, 2));

    if (payment.billId) {
      const bill = await Bill.findById(payment.billId);
      console.log("\n💰 Bill Info:");
      console.log("==================");
      console.log("Bill ID:", bill._id);
      console.log("Bill Type:", bill.billType);
      console.log("Status:", bill.status);
      console.log("Amount Due:", bill.amountDue.toString());
      console.log("Amount Paid:", bill.amountPaid.toString());
    }

    // Check if callback was received
    if (payment.metadata?.callbackData) {
      console.log("\n✅ Callback was received!");
      console.log("Callback Data:", JSON.stringify(payment.metadata.callbackData, null, 2));
    } else {
      console.log("\n⚠️ No callback data found - callback may not have been called");
    }

    // Check return handler
    if (payment.metadata?.returnData) {
      console.log("\n✅ Return handler was called!");
      console.log("Return Data:", JSON.stringify(payment.metadata.returnData, null, 2));
    } else {
      console.log("\n⚠️ No return data found - return handler may not have been called");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

debugPayment();

