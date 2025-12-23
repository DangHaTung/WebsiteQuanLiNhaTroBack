// Script để restore lại endDate từ lịch sử gia hạn
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function restoreContractDate() {
  try {
    console.log("🔄 Restore Contract Date from Extension History\n");

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const FinalContract = (await import("../src/models/finalContract.model.js")).default;
    const Contract = (await import("../src/models/contract.model.js")).default;

    // Find contracts with extension history
    const contractsWithExtensions = await FinalContract.find({
      status: "SIGNED",
      "metadata.extensions": { $exists: true, $ne: [] }
    })
      .populate("tenantId", "fullName email")
      .populate("roomId", "roomNumber")
      .sort({ endDate: 1 });

    if (contractsWithExtensions.length === 0) {
      console.log("❌ No contracts with extension history found.");
      rl.close();
      return;
    }

    console.log("📋 Contracts with extension history:\n");
    contractsWithExtensions.forEach((fc, idx) => {
      const extensions = fc.metadata?.extensions || [];
      const lastExtension = extensions[extensions.length - 1];
      
      console.log(`${idx + 1}. ID: ${fc._id}`);
      console.log(`   Room: ${fc.roomId?.roomNumber || "N/A"}`);
      console.log(`   Tenant: ${fc.tenantId?.fullName || "N/A"}`);
      console.log(`   Current End Date: ${new Date(fc.endDate).toLocaleDateString("vi-VN")}`);
      console.log(`   Extensions: ${extensions.length} times`);
      if (lastExtension) {
        console.log(`   Last extension: ${new Date(lastExtension.extendedAt).toLocaleDateString("vi-VN")}`);
        console.log(`   Previous date: ${new Date(lastExtension.previousEndDate).toLocaleDateString("vi-VN")}`);
      }
      console.log();
    });

    const contractIndex = await question("Enter contract number to restore (or 'q' to quit): ");
    
    if (contractIndex.toLowerCase() === 'q') {
      console.log("👋 Exiting...");
      rl.close();
      return;
    }

    const selectedIndex = parseInt(contractIndex) - 1;
    if (selectedIndex < 0 || selectedIndex >= contractsWithExtensions.length) {
      console.log("❌ Invalid contract number");
      rl.close();
      return;
    }

    const selectedContract = contractsWithExtensions[selectedIndex];
    const extensions = selectedContract.metadata?.extensions || [];
    
    if (extensions.length === 0) {
      console.log("❌ No extension history found");
      rl.close();
      return;
    }

    console.log(`\n✅ Selected: ${selectedContract.roomId?.roomNumber} - ${selectedContract.tenantId?.fullName}`);
    console.log(`Current end date: ${new Date(selectedContract.endDate).toLocaleDateString("vi-VN")}`);
    console.log(`\n📜 Extension History:`);
    
    extensions.forEach((ext, idx) => {
      console.log(`\n${idx + 1}. Extended at: ${new Date(ext.extendedAt).toLocaleString("vi-VN")}`);
      console.log(`   Previous: ${new Date(ext.previousEndDate).toLocaleDateString("vi-VN")}`);
      console.log(`   New: ${new Date(ext.newEndDate).toLocaleDateString("vi-VN")}`);
      console.log(`   +${ext.extensionMonths} months`);
    });

    console.log("\n📅 Restore options:");
    console.log("1. Undo last extension (restore to previous date)");
    console.log("2. Remove all extensions (restore to original)");
    
    const option = await question("\nEnter option (1-2): ");

    let restoreDate;
    let removeExtensions = [];

    if (option === "1") {
      // Undo last extension
      const lastExtension = extensions[extensions.length - 1];
      restoreDate = new Date(lastExtension.previousEndDate);
      removeExtensions = [extensions.length - 1];
    } else if (option === "2") {
      // Remove all extensions
      const firstExtension = extensions[0];
      restoreDate = new Date(firstExtension.previousEndDate);
      removeExtensions = extensions.map((_, idx) => idx);
    } else {
      console.log("❌ Invalid option");
      rl.close();
      return;
    }

    console.log(`\n📅 Will restore to: ${restoreDate.toLocaleDateString("vi-VN")}`);
    const confirm = await question("\nConfirm restore? (yes/no): ");
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log("❌ Restore cancelled");
      rl.close();
      return;
    }

    // Update
    console.log("\n🔄 Restoring contract...");

    selectedContract.endDate = restoreDate;
    
    // Remove extensions from history
    if (option === "1") {
      selectedContract.metadata.extensions.pop();
    } else if (option === "2") {
      selectedContract.metadata.extensions = [];
    }
    
    await selectedContract.save();

    // Update origin Contract
    if (selectedContract.originContractId) {
      await Contract.findByIdAndUpdate(selectedContract.originContractId, {
        endDate: restoreDate
      });
      console.log(`✅ Updated origin Contract`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ CONTRACT DATE RESTORED!");
    console.log("=".repeat(60));
    console.log(`Contract ID: ${selectedContract._id}`);
    console.log(`Restored to: ${restoreDate.toLocaleDateString("vi-VN")}`);
    console.log(`Extensions removed: ${removeExtensions.length}`);
    console.log(`Remaining extensions: ${selectedContract.metadata.extensions.length}`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    rl.close();
  }
}

restoreContractDate();
