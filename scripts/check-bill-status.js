// Check bill status from URL
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

// Get billId from command line argument
const url = process.argv[2];
if (!url) {
  console.log("Usage: node check-bill-status.js <payment-url>");
  console.log("Example: node check-bill-status.js http://localhost:5173/public/payment/691465.../token...");
  process.exit(1);
}

// Parse billId and token from URL
const match = url.match(/\/public\/payment\/([^\/]+)\/([^\/\?]+)/);
if (!match) {
  console.log("❌ Invalid URL format");
  process.exit(1);
}

const billId = match[1];
const token = match[2];

console.log("=".repeat(60));
console.log("🔍 CHECK BILL STATUS");
console.log("=".repeat(60));
console.log("Bill ID:", billId);
console.log("Token:", token.substring(0, 20) + "...");

async function checkBill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Bill = (await import("../src/models/bill.model.js")).default;
    const bill = await Bill.findById(billId).populate("contractId");

    if (!bill) {
      console.log("❌ Bill not found");
      process.exit(1);
    }

    console.log("\n📋 Bill Info:");
    console.log("- Status:", bill.status);
    console.log("- Bill Type:", bill.billType);
    console.log("- Amount Due:", bill.amountDue?.toString());
    console.log("- Amount Paid:", bill.amountPaid?.toString());
    console.log("- Payment Token:", bill.paymentToken ? bill.paymentToken.substring(0, 20) + "..." : "NOT SET");
    console.log("- Token Expires:", bill.paymentTokenExpires);
    console.log("- Payments count:", bill.payments?.length || 0);

    console.log("\n🔐 Token Verification:");
    if (!bill.paymentToken) {
      console.log("❌ Bill không có payment token!");
      console.log("   → Có thể checkin được tạo trước khi code mới được deploy");
      console.log("   → Giải pháp: Tạo checkin mới");
    } else if (bill.paymentToken !== token) {
      console.log("❌ Token không khớp!");
      console.log("   Expected:", bill.paymentToken.substring(0, 20) + "...");
      console.log("   Got:", token.substring(0, 20) + "...");
    } else {
      console.log("✅ Token hợp lệ");
    }

    if (bill.paymentTokenExpires) {
      const now = new Date();
      const expired = now > bill.paymentTokenExpires;
      console.log("\n⏰ Token Expiry:");
      console.log("- Expires at:", bill.paymentTokenExpires);
      console.log("- Current time:", now);
      console.log("- Status:", expired ? "❌ Đã hết hạn" : "✅ Còn hiệu lực");
    }

    console.log("\n💡 Giải pháp:");
    if (bill.status === "PAID") {
      console.log("- Bill đã thanh toán → Tạo checkin mới để test");
    } else if (!bill.paymentToken) {
      console.log("- Bill không có token → Tạo checkin mới (sau khi deploy code mới)");
    } else {
      console.log("- Bill có thể thanh toán được");
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkBill();
