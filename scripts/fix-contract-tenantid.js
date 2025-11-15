import mongoose from "mongoose";
import FinalContract from "../src/models/finalContract.model.js";
import Contract from "../src/models/contract.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/QuanLy360";

async function fixContractTenantId() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Lấy tất cả FinalContracts có tenantId
    const finalContracts = await FinalContract.find({ 
      tenantId: { $exists: true, $ne: null },
      originContractId: { $exists: true, $ne: null }
    });

    console.log(`📊 Found ${finalContracts.length} FinalContracts with tenantId`);

    let updated = 0;
    for (const fc of finalContracts) {
      try {
        const result = await Contract.findByIdAndUpdate(
          fc.originContractId,
          { tenantId: fc.tenantId },
          { new: true }
        );
        
        if (result) {
          console.log(`✅ Updated Contract ${fc.originContractId} with tenantId ${fc.tenantId}`);
          updated++;
        }
      } catch (err) {
        console.error(`❌ Error updating Contract ${fc.originContractId}:`, err.message);
      }
    }

    console.log(`\n✅ Updated ${updated} contracts`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixContractTenantId();
