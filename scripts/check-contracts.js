import mongoose from "mongoose";
import dotenv from "dotenv";
// Load environment variables
dotenv.config();
async function checkContracts() {
  // Kết nối đến MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
// Import các model cần thiết
    const Contract = (await import("../src/models/contract.model.js")).default;
    const Room = (await import("../src/models/room.model.js")).default;
    const User = (await import("../src/models/user.model.js")).default;
  // Tìm các contract với trạng thái ACTIVE
    const activeContracts = await Contract.find({ status: "ACTIVE" })
      .populate("roomId", "roomNumber")
      .populate("tenantId", "fullName")
      .lean();
  // Hiển thị thông tin các contract tìm được
    console.log(`\n📋 Found ${activeContracts.length} ACTIVE contracts:`);
    
    for (const contract of activeContracts) {
      console.log(`\n🔍 Contract ID: ${contract._id}`);
      console.log(`   Room: ${contract.roomId?.roomNumber || "N/A"}`);
      console.log(`   Tenant: ${contract.tenantId?.fullName || contract.tenantSnapshot?.fullName || "N/A"}`);
      console.log(`   Start: ${contract.startDate}`);
      console.log(`   End: ${contract.endDate}`);
    }
// Gợi ý tạo draft bill cho các contract ACTIVE
    if (activeContracts.length === 0) {
      console.log("\n⚠️ Không có contract ACTIVE nào để tạo draft bill!");
    }
// Kết thúc kiểm tra
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
  // Kết thúc hàm
}

checkContracts();
