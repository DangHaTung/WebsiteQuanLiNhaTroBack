import fetch from "node-fetch";

const billId = "691ff5107e05d12d00e42617";
const token = "32e1fde65999dc78741edac725184bdc4b30e546a21af7c090fdfb3d893786c7";

async function testAPI() {
  try {
    const url = `http://localhost:3000/api/public/payment/${billId}/${token}`;
    console.log("🔍 Testing API:", url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("\n📊 Response Status:", response.status);
    console.log("📊 Response Data:", JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log("\n✅ API returned success");
      console.log("Bill Status:", data.data?.bill?.status);
    } else {
      console.log("\n❌ API returned error");
      console.log("Error Message:", data.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testAPI();
