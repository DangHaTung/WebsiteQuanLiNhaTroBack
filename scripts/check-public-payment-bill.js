import mongoose from "mongoose";
import dotenv from "dotenv";
import Bill from "../src/models/bill.model.js";
import Contract from "../src/models/contract.model.js";
import Room from "../src/models/room.model.js";

dotenv.config();

async function checkBill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get billId from command line or use latest RECEIPT bill
    const billId = process.argv[2];
    
    let bill;
    if (billId) {
      bill = await Bill.findById(billId).populate("contractId");
    } else {
      // Find latest RECEIPT bill with payment token
      bill = await Bill.findOne({ 
        billType: "RECEIPT",
        paymentToken: { $exists: true, $ne: null }
      })
      .sort({ createdAt: -1 })
      .populate("contractId");
    }

    if (!bill) {
      console.log("❌ No bill found");
      process.exit(0);
    }

    console.log("\n📋 Bill Info:");
    console.log("ID:", bill._id.toString());
    console.log("Type:", bill.billType);
    console.log("Status:", bill.status);
    console.log("Amount Due:", bill.amountDue.toString());
    console.log("Amount Paid:", bill.amountPaid.toString());
    console.log("Payment Token:", bill.paymentToken ? "✅ Exists" : "❌ None");
    console.log("Token Expires:", bill.paymentTokenExpires);

    if (bill.contractId) {
      const contract = bill.contractId;
      console.log("\n📝 Contract Info:");
      console.log("ID:", contract._id.toString());
      console.log("Tenant:", contract.tenantSnapshot?.fullName);
      console.log("Email:", contract.tenantSnapshot?.email);
      console.log("Phone:", contract.tenantSnapshot?.phone);

      if (contract.roomId) {
        const room = await Room.findById(contract.roomId);
        console.log("\n🏠 Room Info:");
        console.log("Room Number:", room?.roomNumber);
      }
    }

    // Build payment URL
    if (bill.paymentToken) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const paymentUrl = `${frontendUrl}/public/payment/${bill._id}/${bill.paymentToken}`;
      console.log("\n🔗 Payment URL:");
      console.log(paymentUrl);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkBill();
