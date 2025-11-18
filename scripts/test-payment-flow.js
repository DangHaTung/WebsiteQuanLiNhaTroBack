import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const Payment = (await import("../src/models/payment.model.js")).default;
const Bill = (await import("../src/models/bill.model.js")).default;

async function testPaymentFlow() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Tìm payment gần nhất
    const recentPayments = await Payment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("billId");

    console.log("\n📋 5 Payment gần nhất:");
    console.log("=".repeat(80));
    
    for (const payment of recentPayments) {
      console.log(`\n💳 Payment ID: ${payment._id}`);
      console.log(`   Provider: ${payment.provider}`);
      console.log(`   TransactionId: ${payment.transactionId}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Amount: ${payment.amount}`);
      console.log(`   Created: ${payment.createdAt}`);
      console.log(`   Metadata returnUrl: ${payment.metadata?.returnUrl || "N/A"}`);
      
      if (payment.billId) {
        const bill = payment.billId;
        console.log(`   📄 Bill ID: ${bill._id}`);
        console.log(`   📄 Bill Status: ${bill.status}`);
        console.log(`   📄 Bill Type: ${bill.billType}`);
        console.log(`   📄 Amount Due: ${bill.amountDue}`);
        console.log(`   📄 Amount Paid: ${bill.amountPaid}`);
        console.log(`   📄 Payments count: ${bill.payments?.length || 0}`);
      }
    }

    // Tìm payment PENDING
    console.log("\n\n⏳ Payment PENDING:");
    console.log("=".repeat(80));
    const pendingPayments = await Payment.find({ status: "PENDING" })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("billId");

    for (const payment of pendingPayments) {
      console.log(`\n💳 Payment ID: ${payment._id}`);
      console.log(`   Provider: ${payment.provider}`);
      console.log(`   TransactionId: ${payment.transactionId}`);
      console.log(`   Amount: ${payment.amount}`);
      console.log(`   Created: ${payment.createdAt}`);
      console.log(`   Metadata returnUrl: ${payment.metadata?.returnUrl || "N/A"}`);
      
      if (payment.billId) {
        const bill = payment.billId;
        console.log(`   📄 Bill Status: ${bill.status}`);
        console.log(`   📄 Bill Type: ${bill.billType}`);
      }
    }

    // Kiểm tra bill có payment nhưng status không đúng
    console.log("\n\n🔍 Checking bills with payments:");
    console.log("=".repeat(80));
    const billsWithPayments = await Bill.find({
      "payments.0": { $exists: true }
    }).sort({ createdAt: -1 }).limit(5);

    for (const bill of billsWithPayments) {
      console.log(`\n📄 Bill ID: ${bill._id}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Type: ${bill.billType}`);
      console.log(`   Amount Due: ${bill.amountDue}`);
      console.log(`   Amount Paid: ${bill.amountPaid}`);
      console.log(`   Payments count: ${bill.payments.length}`);
      
      bill.payments.forEach((p, idx) => {
        console.log(`   Payment ${idx + 1}:`);
        console.log(`     - Provider: ${p.provider}`);
        console.log(`     - Amount: ${p.amount}`);
        console.log(`     - TransactionId: ${p.transactionId}`);
        console.log(`     - PaidAt: ${p.paidAt}`);
      });
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

testPaymentFlow();
