import mongoose from "mongoose";
import Room from "../src/models/room.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function checkRoomStatus() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const room101 = await Room.findOne({ roomNumber: "101" });
    
    if (!room101) {
      console.log("❌ Room 101 not found");
    } else {
      console.log("📊 Room 101 status:", room101.status);
      console.log("Full room data:", JSON.stringify(room101, null, 2));
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkRoomStatus();
