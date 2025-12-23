import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function testConfirmCash() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Bill = (await import("../src/models/bill.model.js")).default;
    const Checkin = (await import("../src/models/checkin.model.js")).default;

    // Tìm bill UNPAID
    const billId = "6918904177abffb20e871bca";
    const bill = await Bill.findById(billId);
    
    if (!bill) {
      console.log("❌ Bill not found");
      return;
    }

    console.log("\n📋 Before payment:");
    console.log(`   Bill ID: ${bill._id}`);
    console.log(`   Type: ${bill.billType}`);
    console.log(`   Status: ${bill.status}`);
    console.log(`   Amount Due: ${bill.amountDue}`);
    console.log(`   Amount Paid: ${bill.amountPaid}`);

    // Tìm checkin
    const checkin = await Checkin.findOne({ receiptBillId: bill._id });
    console.log(`\n📝 Checkin before:`);
    if (checkin) {
      console.log(`   ID: ${checkin._id}`);
      console.log(`   Status: ${checkin.status}`);
    } else {
      console.log(`   ❌ No checkin found`);
    }

    // Simulate confirmCashPayment
    const amountDue = parseFloat(bill.amountDue.toString());
    const amountPaid = parseFloat(bill.amountPaid.toString()) || 0;
    const amountToAdd = amountDue - amountPaid;

    console.log(`\n💰 Payment calculation:`);
    console.log(`   Amount Due: ${amountDue}`);
    console.log(`   Amount Paid: ${amountPaid}`);
    console.log(`   Amount to Add: ${amountToAdd}`);

    // Add payment
    if (!bill.payments) bill.payments = [];
    bill.payments.push({
      paidAt: new Date(),
      amount: mongoose.Types.Decimal128.fromString(amountToAdd.toFixed(2)),
      method: "CASH",
      provider: "OFFLINE",
      transactionId: `cash-test-${Date.now()}`,
      note: "Test xác nhận tiền mặt",
    });

    // Update amountPaid
    const newPaid = amountPaid + amountToAdd;
    bill.amountPaid = mongoose.Types.Decimal128.fromString(newPaid.toFixed(2));

    // Update status
    if (newPaid >= amountDue) {
      bill.status = "PAID";
    } else if (newPaid > 0) {
      bill.status = "PARTIALLY_PAID";
    }

    await bill.save();

    console.log(`\n📋 After payment:`);
    console.log(`   Status: ${bill.status}`);
    console.log(`   Amount Paid: ${bill.amountPaid}`);

    // Auto-complete checkin
    if (bill.billType === "RECEIPT" && bill.status === "PAID") {
      console.log(`\n🔍 Checking for checkin to auto-complete...`);
      const checkinToUpdate = await Checkin.findOne({ receiptBillId: bill._id });
      console.log(`   Found checkin:`, checkinToUpdate ? `ID=${checkinToUpdate._id}, status=${checkinToUpdate.status}` : 'null');
      
      if (checkinToUpdate && checkinToUpdate.status === "CREATED") {
        checkinToUpdate.status = "COMPLETED";
        await checkinToUpdate.save();
        console.log(`   ✅ Auto-completed checkin ${checkinToUpdate._id}`);
      } else if (checkinToUpdate) {
        console.log(`   ⚠️ Checkin found but status is ${checkinToUpdate.status}, not CREATED`);
      } else {
        console.log(`   ❌ No checkin found with receiptBillId: ${bill._id}`);
      }
    }

    // Verify final state
    const finalCheckin = await Checkin.findOne({ receiptBillId: bill._id });
    console.log(`\n📝 Checkin after:`);
    if (finalCheckin) {
      console.log(`   ID: ${finalCheckin._id}`);
      console.log(`   Status: ${finalCheckin.status}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

testConfirmCash();
