import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const Contract = (await import("../src/models/contract.model.js")).default;
const Room = (await import("../src/models/room.model.js")).default;
const User = (await import("../src/models/user.model.js")).default;

async function testContractsAPI() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Test query contracts
    console.log("\n🔍 Testing contract query:");
    const contracts = await Contract.find({ status: "ACTIVE" })
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth")
      .limit(5);

    console.log(`   Found ${contracts.length} ACTIVE contracts`);

    contracts.forEach((contract, idx) => {
      console.log(`\n   Contract ${idx + 1}:`);
      console.log(`   - ID: ${contract._id}`);
      console.log(`   - Room: ${contract.roomId?.roomNumber || "N/A"}`);
      console.log(`   - Tenant: ${contract.tenantId?.fullName || "N/A"}`);
      console.log(`   - Co-tenants: ${contract.coTenants?.length || 0}`);
      console.log(`   - Status: ${contract.status}`);
      console.log(`   - Monthly Rent: ${contract.monthlyRent}`);
    });

    if (contracts.length === 0) {
      console.log("\n⚠️ No ACTIVE contracts found!");
      console.log("   Creating a test contract...");

      // Tìm room và user để tạo contract test
      const room = await Room.findOne();
      const user = await User.findOne({ role: "TENANT" });

      if (room && user) {
        const testContract = await Contract.create({
          tenantId: user._id,
          roomId: room._id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          deposit: mongoose.Types.Decimal128.fromString("3000000"),
          monthlyRent: mongoose.Types.Decimal128.fromString("3000000"),
          status: "ACTIVE",
          pricingSnapshot: {
            roomNumber: room.roomNumber,
            monthlyRent: mongoose.Types.Decimal128.fromString("3000000"),
            deposit: mongoose.Types.Decimal128.fromString("3000000"),
          },
        });

        console.log(`   ✅ Created test contract: ${testContract._id}`);
      } else {
        console.log("   ❌ Cannot create test contract - missing room or user");
      }
    }

    console.log("\n✅ Test completed!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

testContractsAPI();
