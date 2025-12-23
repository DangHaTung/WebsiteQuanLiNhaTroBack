import fetch from "node-fetch";

const API_URL = "http://localhost:3000";
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.log("Usage: node scripts/test-contracts-endpoint.js <YOUR_TOKEN>");
  process.exit(1);
}

async function testEndpoints() {
  console.log("🔍 Testing /api/contracts endpoint...\n");

  try {
    // Test 1: GET /api/contracts
    console.log("1️⃣ Testing GET /api/contracts?status=ACTIVE&limit=100");
    const res1 = await fetch(`${API_URL}/api/contracts?status=ACTIVE&limit=100`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });
    console.log("   Status:", res1.status, res1.statusText);
    const data1 = await res1.json();
    console.log("   Response:", JSON.stringify(data1, null, 2).substring(0, 500));

    if (!data1.success) {
      console.log("\n❌ API returned error:", data1.message);
      return;
    }

    console.log(`\n✅ Found ${data1.data?.length || 0} contracts`);

    // Test 2: POST /api/contracts/:id/add-cotenant (nếu có contract)
    if (data1.data && data1.data.length > 0) {
      const contractId = data1.data[0]._id;
      console.log(`\n2️⃣ Testing POST /api/contracts/${contractId}/add-cotenant`);
      
      const res2 = await fetch(`${API_URL}/api/contracts/${contractId}/add-cotenant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          fullName: "Test User",
          phone: "0999999999",
          email: "test@example.com",
          password: "123456",
        }),
      });
      
      console.log("   Status:", res2.status, res2.statusText);
      const data2 = await res2.json();
      console.log("   Response:", JSON.stringify(data2, null, 2).substring(0, 500));
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

testEndpoints();
