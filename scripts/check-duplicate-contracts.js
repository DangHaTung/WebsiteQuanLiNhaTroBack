import mongoose from "mongoose";
import Contract from "../src/models/contract.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function checkDuplicates() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const contracts = await Contract.find().lean();
    console.log(`📊 Total contracts: ${contracts.length}`);

    // Group by key fields to find duplicates
    const groups = {};
    contracts.forEach(c => {
      const key = `${c.roomId}_${c.tenantId}_${c.startDate}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Find duplicates
    const duplicates = Object.entries(groups).filter(([_, items]) => items.length > 1);
    
    if (duplicates.length === 0) {
      console.log("✅ No duplicates found");
    } else {
      console.log(`⚠️ Found ${duplicates.length} duplicate groups:`);
      duplicates.forEach(([key, items]) => {
        console.log(`\n🔴 Duplicate group (${items.length} items):`);
        items.forEach(item => {
          console.log(`  - ID: ${item._id}, Room: ${item.roomId}, Tenant: ${item.tenantId}`);
        });
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkDuplicates();
