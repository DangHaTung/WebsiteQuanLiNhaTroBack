import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkContractStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Contract = (await import("../src/models/contract.model.js")).default;
    const FinalContract = (await import("../src/models/finalContract.model.js")).default;
    const Bill = (await import("../src/models/bill.model.js")).default;
    
    const contractId = "6918a1e5e8fdc9aa4daf3612";
    
    const contract = await Contract.findById(contractId);
    console.log(`\n📋 Contract ${contractId}:`);
    console.log(`   Status: ${contract?.status || "NOT FOUND"}`);
    
    // Check FinalContract
    const finalContract = await FinalContract.findOne({ 
      originContractId: contractId,
      status: "SIGNED"
    });
    
    if (finalContract) {
      console.log(`\n✅ FinalContract SIGNED found: ${finalContract._id}`);
    } else {
      console.log(`\n❌ No FinalContract SIGNED found`);
      const anyFinal = await FinalContract.findOne({ originContractId: contractId });
      if (anyFinal) {
        console.log(`   Found FinalContract with status: ${anyFinal.status}`);
      }
    }
    
    // Check Bill CONTRACT
    const contractBill = await Bill.findOne({
      contractId,
      billType: "CONTRACT",
    });
    
    if (contractBill) {
      console.log(`\n📄 Bill CONTRACT found: ${contractBill._id}`);
      console.log(`   Status: ${contractBill.status}`);
      if (contractBill.status === "PAID") {
        console.log(`   ✅ PAID`);
      } else {
        console.log(`   ❌ Not PAID`);
      }
    } else {
      console.log(`\n❌ No Bill CONTRACT found`);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

checkContractStatus();
