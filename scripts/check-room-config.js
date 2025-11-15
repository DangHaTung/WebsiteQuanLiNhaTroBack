import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkRoomConfig() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Room = (await import("../src/models/room.model.js")).default;
    const RoomFee = (await import("../src/models/roomFee.model.js")).default;
    const UtilityFee = (await import("../src/models/utilityFee.model.js")).default;
    
    // Check room 101
    const room = await Room.findOne({ roomNumber: "101" });
    if (!room) {
      console.log("❌ Room 101 not found");
      return;
    }
    
    console.log(`\n📋 Room 101 (ID: ${room._id})`);
    console.log(`   Price: ${room.pricePerMonth}`);
    
    // Check RoomFee
    const roomFee = await RoomFee.findOne({ roomId: room._id, isActive: true });
    if (!roomFee) {
      console.log("\n❌ Room 101 chưa có RoomFee config!");
      console.log("   Cần tạo RoomFee cho phòng này");
    } else {
      console.log(`\n✅ RoomFee found:`);
      console.log(`   Applied types: ${roomFee.appliedTypes.join(", ")}`);
    }
    
    // Check UtilityFees
    const utilityFees = await UtilityFee.find({ isActive: true });
    console.log(`\n📊 Active UtilityFees: ${utilityFees.length}`);
    for (const fee of utilityFees) {
      console.log(`   - ${fee.type}: ${fee.baseRate || "N/A"}`);
    }
    
    if (utilityFees.length === 0) {
      console.log("\n❌ Không có UtilityFee nào active!");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

checkRoomConfig();
