import mongoose from "mongoose";
import Payment from "../src/models/payment.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function clearPendingPayments() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Xóa tất cả payment PENDING (chưa thanh toán)
    const result = await Payment.deleteMany({ status: "PENDING" });
    console.log(`🗑️  Đã xóa ${result.deletedCount} payment PENDING`);

    // Hoặc xóa tất cả payment (nếu muốn reset hoàn toàn)
    // const result = await Payment.deleteMany({});
    // console.log(`🗑️  Đã xóa ${result.deletedCount} payment`);

    await mongoose.disconnect();
    console.log("✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

clearPendingPayments();
