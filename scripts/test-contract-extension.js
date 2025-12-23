// Script test chức năng gia hạn hợp đồng
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;
const API_URL = process.env.API_URL || "http://localhost:3000";

async function testContractExtension() {
  try {
    console.log("🔧 Testing Contract Extension Feature...\n");

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const FinalContract = (await import("../src/models/finalContract.model.js")).default;

    // 1. Tìm hợp đồng SIGNED để test
    console.log("📋 Step 1: Finding SIGNED contracts...");
    const signedContracts = await FinalContract.find({ status: "SIGNED" })
      .populate("tenantId", "fullName email")
      .populate("roomId", "roomNumber")
      .limit(5)
      .sort({ endDate: 1 });

    if (signedContracts.length === 0) {
      console.log("❌ No SIGNED contracts found. Please create a contract first.");
      return;
    }

    console.log(`✅ Found ${signedContracts.length} SIGNED contracts:\n`);
    signedContracts.forEach((fc, idx) => {
      const daysUntilExpiry = Math.ceil((new Date(fc.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`${idx + 1}. Contract ID: ${fc._id}`);
      console.log(`   Room: ${fc.roomId?.roomNumber || "N/A"}`);
      console.log(`   Tenant: ${fc.tenantId?.fullName || "N/A"}`);
      console.log(`   End Date: ${new Date(fc.endDate).toLocaleDateString("vi-VN")}`);
      console.log(`   Days until expiry: ${daysUntilExpiry} days`);
      console.log(`   Extensions: ${fc.metadata?.extensions?.length || 0} times\n`);
    });

    // 2. Test API get expiring soon contracts
    console.log("\n📋 Step 2: Testing GET /api/final-contracts/expiring-soon");
    console.log("API Endpoint: GET " + API_URL + "/api/final-contracts/expiring-soon?days=90");
    console.log("Note: You need to call this API with admin token to see results\n");

    // 3. Chọn contract đầu tiên để test extend
    const testContract = signedContracts[0];
    console.log("📋 Step 3: Testing contract extension");
    console.log(`Selected contract: ${testContract._id}`);
    console.log(`Current end date: ${new Date(testContract.endDate).toLocaleDateString("vi-VN")}`);

    // Simulate extension (6 months)
    const extensionMonths = 6;
    const currentEndDate = new Date(testContract.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);

    console.log(`\n🔄 Simulating extension: +${extensionMonths} months`);
    console.log(`New end date would be: ${newEndDate.toLocaleDateString("vi-VN")}`);

    console.log("\n📝 To extend this contract via API:");
    console.log(`PUT ${API_URL}/api/final-contracts/${testContract._id}/extend`);
    console.log("Headers: { Authorization: Bearer <admin_token> }");
    console.log("Body: { extensionMonths: 6 }");

    // 4. Show extension history if exists
    if (testContract.metadata?.extensions && testContract.metadata.extensions.length > 0) {
      console.log("\n📜 Extension History:");
      testContract.metadata.extensions.forEach((ext, idx) => {
        console.log(`\n${idx + 1}. Extended at: ${new Date(ext.extendedAt).toLocaleString("vi-VN")}`);
        console.log(`   Previous end: ${new Date(ext.previousEndDate).toLocaleDateString("vi-VN")}`);
        console.log(`   New end: ${new Date(ext.newEndDate).toLocaleDateString("vi-VN")}`);
        console.log(`   Extension: +${ext.extensionMonths} months`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Test completed successfully!");
    console.log("=".repeat(60));

    console.log("\n📌 QUICK TEST GUIDE:");
    console.log("1. Login as admin to get token");
    console.log("2. Use Postman/Thunder Client to call:");
    console.log(`   PUT ${API_URL}/api/final-contracts/${testContract._id}/extend`);
    console.log("3. Body: { \"extensionMonths\": 6 }");
    console.log("4. Check response and verify endDate changed");
    console.log("5. Check metadata.extensions array for history\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

testContractExtension();
