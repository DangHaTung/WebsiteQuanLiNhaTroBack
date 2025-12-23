import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function debugRoute() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Import controller để test trực tiếp
    const { getAllContracts, addCoTenant } = await import("../src/controllers/contract.controller.js");
    
    console.log("\n🔍 Checking if functions exist:");
    console.log("   getAllContracts:", typeof getAllContracts);
    console.log("   addCoTenant:", typeof addCoTenant);

    // Test getAllContracts
    console.log("\n📋 Testing getAllContracts...");
    const mockReq = {
      query: { status: "ACTIVE", limit: 100 },
      user: { _id: "68f3b7bb6460861c887a5ce1", role: "ADMIN" },
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`   Response status: ${code}`);
          console.log(`   Response data:`, JSON.stringify(data, null, 2).substring(0, 500));
          return data;
        },
      }),
      json: (data) => {
        console.log(`   Response data:`, JSON.stringify(data, null, 2).substring(0, 500));
        return data;
      },
    };

    await getAllContracts(mockReq, mockRes);

    console.log("\n✅ Test completed!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

debugRoute();
