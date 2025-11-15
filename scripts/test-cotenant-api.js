import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const Contract = (await import("../src/models/contract.model.js")).default;
const FinalContract = (await import("../src/models/finalContract.model.js")).default;
const Bill = (await import("../src/models/bill.model.js")).default;
const Room = (await import("../src/models/room.model.js")).default;

async function testCoTenantFeature() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Tìm một contract ACTIVE
    const activeContract = await Contract.findOne({ status: "ACTIVE" }).populate("roomId");
    
    if (!activeContract) {
      console.log("❌ Không tìm thấy contract ACTIVE nào");
      return;
    }

    console.log("\n📋 Contract hiện tại:");
    console.log(`   ID: ${activeContract._id}`);
    console.log(`   Room: ${activeContract.roomId.roomNumber}`);
    console.log(`   Tenant: ${activeContract.tenantId}`);
    console.log(`   Co-tenants: ${activeContract.coTenants?.length || 0}`);

    // 2. Kiểm tra model có field coTenants không
    console.log("\n🔍 Checking Contract schema:");
    console.log(`   Has coTenants field: ${activeContract.coTenants !== undefined}`);

    // 3. Kiểm tra FinalContract model
    const sampleFC = await FinalContract.findOne();
    if (sampleFC) {
      console.log("\n🔍 Checking FinalContract schema:");
      console.log(`   Has linkedContractId: ${sampleFC.linkedContractId !== undefined}`);
      console.log(`   Has isCoTenant: ${sampleFC.isCoTenant !== undefined}`);
    }

    // 4. Test query bills với co-tenant
    console.log("\n🔍 Testing bill query logic:");
    const testUserId = activeContract.tenantId;
    
    // Query như trong getUserContractIds helper
    const contracts = await Contract.find({
      $or: [
        { tenantId: testUserId },
        { "coTenants.userId": testUserId }
      ]
    });
    
    console.log(`   Found ${contracts.length} contracts for user ${testUserId}`);

    console.log("\n✅ All tests passed!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

testCoTenantFeature();
