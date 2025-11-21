// Script để set hợp đồng sắp hết hạn (cho mục đích test)
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

async function setContractExpiringSoon() {
  try {
    console.log("🔧 Set Contract Expiring Soon (For Testing)\n");

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
      const daysUntilExpiry = Math.ceil((new Date(fc.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`${idx + 1}. ID: ${fc._id}`);
      console.log(`   Room: ${fc.roomId?.roomNumber || "N/A"}`);
      console.log(`   Tenant: ${fc.tenantId?.fullName || "N/A"}`);
      console.log(`   Current End Date: ${new Date(fc.endDate).toLocaleDateString("vi-VN")} (${daysUntilExpiry} days)\n`);
    });

    // 2. Ask user to select contract
    const contractIndex = await question("Enter contract number to modify (or 'q' to quit): ");
    
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

    // 3. Show options
    console.log("\n📅 Choose new end date:");
    console.log("1. Set to 7 days from now (expiring soon)");
    console.log("2. Set to 15 days from now");
    console.log("3. Set to 30 days from now");
    console.log("4. Set to yesterday (expired)");
    console.log("5. Set to 3 days ago (expired)");
    console.log("6. Custom date");

    const option = await question("\nEnter option (1-6): ");

    let newEndDate;
    const today = new Date();

    switch(option) {
      case "1":
        newEndDate = new Date(today);
        newEndDate.setDate(newEndDate.getDate() + 7);
        break;
      case "2":
        newEndDate = new Date(today);
        newEndDate.setDate(newEndDate.getDate() + 15);
        break;
      case "3":
        newEndDate = new Date(today);
        newEndDate.setDate(newEndDate.getDate() + 30);
        break;
      case "4":
        newEndDate = new Date(today);
        newEndDate.setDate(newEndDate.getDate() - 1);
        break;
      case "5":
        newEndDate = new Date(today);
        newEndDate.setDate(newEndDate.getDate() - 3);
        break;
      case "6":
        const customDate = await question("Enter date (YYYY-MM-DD): ");
        newEndDate = new Date(customDate);
        if (isNaN(newEndDate.getTime())) {
          console.log("❌ Invalid date format");
          rl.close();
          return;
        }
        break;
      default:
        console.log("❌ Invalid option");
        rl.close();
        return;
    }

    const daysUntilExpiry = Math.ceil((newEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`\n📅 New end date will be: ${newEndDate.toLocaleDateString("vi-VN")}`);
    console.log(`   Days until expiry: ${daysUntilExpiry} days ${daysUntilExpiry < 0 ? "(EXPIRED)" : ""}`);

    // 4. Confirm
    const confirm = await question("\nConfirm change? (yes/no): ");
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log("❌ Change cancelled");
      rl.close();
      return;
    }

    // 5. Update
    console.log("\n🔄 Updating contract...");

    const oldEndDate = selectedContract.endDate;
    selectedContract.endDate = newEndDate;
    await selectedContract.save();

    // Update origin Contract if exists
    if (selectedContract.originContractId) {
      await Contract.findByIdAndUpdate(selectedContract.originContractId, {
        endDate: newEndDate
      });
      console.log(`✅ Updated origin Contract ${selectedContract.originContractId}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ CONTRACT END DATE UPDATED!");
    console.log("=".repeat(60));
    console.log(`Contract ID: ${selectedContract._id}`);
    console.log(`Room: ${selectedContract.roomId?.roomNumber}`);
    console.log(`Tenant: ${selectedContract.tenantId?.fullName}`);
    console.log(`Old end date: ${new Date(oldEndDate).toLocaleDateString("vi-VN")}`);
    console.log(`New end date: ${newEndDate.toLocaleDateString("vi-VN")}`);
    console.log(`Days until expiry: ${daysUntilExpiry} days`);
    console.log("=".repeat(60));
    
    console.log("\n💡 Now you can:");
    console.log("1. Go to admin panel → Quản lý hợp đồng");
    console.log("2. Find this contract (should show expiring warning)");
    console.log("3. Click 'Gia hạn' button to test extension");
    console.log("4. After testing, you can run this script again to restore the date\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    rl.close();
  }
}

setContractExpiringSoon();
