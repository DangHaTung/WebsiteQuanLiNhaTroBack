import mongoose from "mongoose";
import Bill from "../src/models/bill.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function checkBillLineItems() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Lấy 1 bill đã publish
    const bill = await Bill.findOne({ status: { $ne: "DRAFT" } }).sort({ createdAt: -1 });
    
    if (!bill) {
      console.log("❌ No published bills found");
      await mongoose.disconnect();
      return;
    }

    console.log("\n📊 Bill ID:", bill._id);
    console.log("📊 Bill status:", bill.status);
    console.log("📊 Bill type:", bill.billType);
    console.log("\n📋 LineItems:");
    console.log(JSON.stringify(bill.lineItems, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkBillLineItems();
