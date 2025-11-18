import mongoose from "mongoose";
import Room from "../src/models/room.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function fixRoomStatus() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Update tất cả rooms có status tiếng Việt sang enum
    const result = await Room.updateMany(
      { status: "Đang thuê" },
      { $set: { status: "OCCUPIED" } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} rooms from "Đang thuê" to "OCCUPIED"`);

    // Update các status khác nếu có
    const result2 = await Room.updateMany(
      { status: "Còn trống" },
      { $set: { status: "AVAILABLE" } }
    );
    console.log(`✅ Updated ${result2.modifiedCount} rooms from "Còn trống" to "AVAILABLE"`);

    const result3 = await Room.updateMany(
      { status: "Bảo trì" },
      { $set: { status: "MAINTENANCE" } }
    );
    console.log(`✅ Updated ${result3.modifiedCount} rooms from "Bảo trì" to "MAINTENANCE"`);

    // Verify
    const room101 = await Room.findOne({ roomNumber: "101" });
    console.log("\n📊 Room 101 new status:", room101.status);

    await mongoose.disconnect();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixRoomStatus();
