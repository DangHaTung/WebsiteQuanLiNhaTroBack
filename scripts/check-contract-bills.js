import mongoose from "mongoose";
import dotenv from "dotenv";
import Bill from "../src/models/bill.model.js";
import Contract from "../src/models/contract.model.js";

dotenv.config();

async function checkContractBills() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const contractId = process.argv[2] || "691ffa0875592bc88100162c";
    
    const contract = await Contract.findById(contractId);
    if (!contract) {
      console.log("❌ Contract not found");
      process.exit(0);
    }

    console.log("📝 Contract Info:");
    console.log("ID:", contract._id.toString());
    console.log("Deposit:", contract.deposit.toString());
    console.log("Monthly Rent:", contract.monthlyRent.toString());
    console.log();

    const bills = await Bill.find({ contractId }).sort({ createdAt: 1 });
    
    console.log(`📋 Found ${bills.length} bills:\n`);

    let totalDue = 0;
    let totalPaid = 0;

    for (const bill of bills) {
      console.log("━".repeat(80));
      console.log(`Bill ID: ${bill._id}`);
      console.log(`Type: ${bill.billType}`);
      console.log(`Status: ${bill.status}`);
      console.log(`Amount Due: ${bill.amountDue.toString()}`);
      console.log(`Amount Paid: ${bill.amountPaid.toString()}`);
      console.log(`Created: ${bill.createdAt}`);
      
      if (bill.lineItems && bill.lineItems.length > 0) {
        console.log("Line Items:");
        bill.lineItems.forEach(item => {
          console.log(`  - ${item.item}: ${item.lineTotal.toString()}`);
        });
      }
      
      totalDue += parseFloat(bill.amountDue.toString());
      totalPaid += parseFloat(bill.amountPaid.toString());
      console.log();
    }

    console.log("━".repeat(80));
    console.log("📊 Summary:");
    console.log(`Total Amount Due: ${totalDue.toLocaleString("vi-VN")} đ`);
    console.log(`Total Amount Paid: ${totalPaid.toLocaleString("vi-VN")} đ`);
    console.log(`Balance: ${(totalDue - totalPaid).toLocaleString("vi-VN")} đ`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkContractBills();
