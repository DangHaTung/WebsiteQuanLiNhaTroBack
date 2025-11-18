import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function debugCheckinBill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Bill = (await import("../src/models/bill.model.js")).default;
    const Checkin = (await import("../src/models/checkin.model.js")).default;

    // Lấy tất cả bills RECEIPT
    const receiptBills = await Bill.find({ billType: "RECEIPT" }).lean();
    console.log(`\n📋 Found ${receiptBills.length} RECEIPT bills`);

    for (const bill of receiptBills) {
      console.log(`\n🔍 Bill ID: ${bill._id}`);
      console.log(`   Type: ${bill.billType}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Amount Due: ${bill.amountDue}`);
      console.log(`   Amount Paid: ${bill.amountPaid}`);

      // Tìm checkin liên kết
      const checkin = await Checkin.findOne({ receiptBillId: bill._id }).lean();
      if (checkin) {
        console.log(`   ✅ Found checkin: ${checkin._id}`);
        console.log(`      Checkin status: ${checkin.status}`);
        console.log(`      Tenant: ${checkin.tenantSnapshot?.fullName || "N/A"}`);
        console.log(`      Room: ${checkin.roomId}`);
      } else {
        console.log(`   ❌ No checkin found with receiptBillId: ${bill._id}`);
      }
    }

    // Lấy tất cả checkins
    const checkins = await Checkin.find({}).lean();
    console.log(`\n\n📝 Found ${checkins.length} total checkins`);
    
    for (const checkin of checkins) {
      console.log(`\n🔍 Checkin ID: ${checkin._id}`);
      console.log(`   Status: ${checkin.status}`);
      console.log(`   Receipt Bill ID: ${checkin.receiptBillId || "N/A"}`);
      console.log(`   Tenant: ${checkin.tenantSnapshot?.fullName || "N/A"}`);
      
      if (checkin.receiptBillId) {
        const bill = await Bill.findById(checkin.receiptBillId).lean();
        if (bill) {
          console.log(`   ✅ Bill found: ${bill._id}`);
          console.log(`      Bill status: ${bill.status}`);
          console.log(`      Bill type: ${bill.billType}`);
        } else {
          console.log(`   ❌ Bill not found: ${checkin.receiptBillId}`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

debugCheckinBill();
