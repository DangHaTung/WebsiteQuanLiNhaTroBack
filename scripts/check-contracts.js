import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkContracts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Contract = (await import("../src/models/contract.model.js")).default;
    const Room = (await import("../src/models/room.model.js")).default;
    const User = (await import("../src/models/user.model.js")).default;
    
    const activeContracts = await Contract.find({ status: "ACTIVE" })
      .populate("roomId", "roomNumber")
      .populate("tenantId", "fullName")
      .lean();
    
    console.log(`\n📋 Found ${activeContracts.length} ACTIVE contracts:`);
    
    for (const contract of activeContracts) {
      console.log(`\n🔍 Contract ID: ${contract._id}`);
      console.log(`   Room: ${contract.roomId?.roomNumber || "N/A"}`);
      console.log(`   Tenant: ${contract.tenantId?.fullName || contract.tenantSnapshot?.fullName || "N/A"}`);
      console.log(`   Start: ${contract.startDate}`);
      console.log(`   End: ${contract.endDate}`);
    }

    if (activeContracts.length === 0) {
      console.log("\n⚠️ Không có contract ACTIVE nào để tạo draft bill!");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

checkContracts();
