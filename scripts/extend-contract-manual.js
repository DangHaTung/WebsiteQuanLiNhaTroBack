// Script để gia hạn hợp đồng thủ công (manual test)
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

async function extendContractManual() {
  try {
    console.log("🔧 Manual Contract Extension Tool\n");

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const FinalContract = (await import("../src/models/finalContract.model.js")).default;
    const Contract = (await import("../src/models/contract.model.js")).default;

    // 1. List all SIGNED contracts
    console.log("📋 Listing all SIGNED contracts:\n");
    const signedContracts = await FinalContract.find({ status: "SIGNED" })
      .populate("tenantId", "fullName email")
      .populate("roomId", "roomNumber")
      .sort({ endDate: 1 });

    if (signedContracts.length === 0) {
      console.log("❌ No SIGNED contracts found.");
      rl.close();
      return;
    }

    signedContracts.forEach((fc, idx) => {
      const daysUntilExpiry = Math.ceil((new Date(fc.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      const expiryStatus = daysUntilExpiry < 0 ? "EXPIRED" : daysUntilExpiry < 30 ? "EXPIRING SOON" : "ACTIVE";
      
      console.log(`${idx + 1}. ID: ${fc._id}`);
      console.log(`   Room: ${fc.roomId?.roomNumber || "N/A"}`);
      console.log(`   Tenant: ${fc.tenantId?.fullName || "N/A"}`);
      console.log(`   End Date: ${new Date(fc.endDate).toLocaleDateString("vi-VN")} (${daysUntilExpiry} days) [${expiryStatus}]`);
      console.log(`   Extensions: ${fc.metadata?.extensions?.length || 0} times\n`);
    });

    // 2. Ask user to select contract
    const contractIndex = await question("Enter contract number to extend (or 'q' to quit): ");
    
    if (contractIndex.toLowerCase() === 'q') {
      console.log("👋 Exiting...");
      rl.close();
      return;
    }

    const selectedIndex = parseInt(contractIndex) - 1;
    if (selectedIndex < 0 || selectedIndex >= signedContracts.length) {
      console.log("❌ Invalid contract number");
      rl.close();
      return;
    }

    const selectedContract = signedContracts[selectedIndex];
    console.log(`\n✅ Selected: ${selectedContract.roomId?.roomNumber} - ${selectedContract.tenantId?.fullName}`);
    console.log(`Current end date: ${new Date(selectedContract.endDate).toLocaleDateString("vi-VN")}`);

    // 3. Ask for extension months
    const extensionInput = await question("\nEnter extension months (6, 12, 24, etc.): ");
    const extensionMonths = parseInt(extensionInput);

    if (isNaN(extensionMonths) || extensionMonths <= 0) {
      console.log("❌ Invalid extension months");
      rl.close();
      return;
    }

    // 4. Calculate new end date
    const currentEndDate = new Date(selectedContract.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);

    console.log(`\n📅 New end date will be: ${newEndDate.toLocaleDateString("vi-VN")}`);

    // 5. Confirm
    const confirm = await question("\nConfirm extension? (yes/no): ");
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log("❌ Extension cancelled");
      rl.close();
      return;
    }

    // 6. Perform extension
    console.log("\n🔄 Extending contract...");

    const oldEndDate = selectedContract.endDate;
    selectedContract.endDate = newEndDate;

    // Save extension history
    if (!selectedContract.metadata) selectedContract.metadata = {};
    if (!selectedContract.metadata.extensions) selectedContract.metadata.extensions = [];

    selectedContract.metadata.extensions.push({
      extendedAt: new Date(),
      extendedBy: "manual-script",
      previousEndDate: oldEndDate,
      newEndDate: newEndDate,
      extensionMonths: extensionMonths
    });

    await selectedContract.save();

    // Update origin Contract if exists
    if (selectedContract.originContractId) {
      await Contract.findByIdAndUpdate(selectedContract.originContractId, {
        endDate: newEndDate
      });
      console.log(`✅ Updated origin Contract ${selectedContract.originContractId}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ CONTRACT EXTENDED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`Contract ID: ${selectedContract._id}`);
    console.log(`Room: ${selectedContract.roomId?.roomNumber}`);
    console.log(`Tenant: ${selectedContract.tenantId?.fullName}`);
    console.log(`Old end date: ${new Date(oldEndDate).toLocaleDateString("vi-VN")}`);
    console.log(`New end date: ${newEndDate.toLocaleDateString("vi-VN")}`);
    console.log(`Extension: +${extensionMonths} months`);
    console.log(`Total extensions: ${selectedContract.metadata.extensions.length} times`);
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

extendContractManual();
