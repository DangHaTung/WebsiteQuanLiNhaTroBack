// Simple script to test contract extension API
console.log("🔄 Contract Extension API Test Guide\n");
console.log("=" .repeat(60));

const API_URL = process.env.API_URL || "http://localhost:3000";

console.log("\n📋 STEP 1: Login as Admin");
console.log("-".repeat(60));
console.log(`POST ${API_URL}/api/auth/login`);
console.log("Body:");
console.log(JSON.stringify({
  email: "admin@example.com",
  password: "your_password"
}, null, 2));
console.log("\n➡️  Save the token from response\n");

console.log("\n📋 STEP 2: Get list of SIGNED contracts");
console.log("-".repeat(60));
console.log(`GET ${API_URL}/api/final-contracts?status=SIGNED`);
console.log("Headers:");
console.log(JSON.stringify({
  "Authorization": "Bearer <your_token_here>"
}, null, 2));
console.log("\n➡️  Pick a contract ID from the response\n");

console.log("\n📋 STEP 3: Extend the contract");
console.log("-".repeat(60));
console.log(`PUT ${API_URL}/api/final-contracts/<contract_id>/extend`);
console.log("Headers:");
console.log(JSON.stringify({
  "Authorization": "Bearer <your_token_here>",
  "Content-Type": "application/json"
}, null, 2));
console.log("\nBody:");
console.log(JSON.stringify({
  extensionMonths: 6
}, null, 2));
console.log("\n➡️  Check the response for new endDate\n");

console.log("\n📋 STEP 4: Verify the extension");
console.log("-".repeat(60));
console.log(`GET ${API_URL}/api/final-contracts/<contract_id>`);
console.log("Headers:");
console.log(JSON.stringify({
  "Authorization": "Bearer <your_token_here>"
}, null, 2));
console.log("\n➡️  Check:");
console.log("   - endDate has changed");
console.log("   - metadata.extensions array has new entry\n");

console.log("\n📋 STEP 5: Get expiring soon contracts");
console.log("-".repeat(60));
console.log(`GET ${API_URL}/api/final-contracts/expiring-soon?days=30`);
console.log("Headers:");
console.log(JSON.stringify({
  "Authorization": "Bearer <your_token_here>"
}, null, 2));
console.log("\n➡️  See contracts expiring in next 30 days\n");

console.log("\n" + "=".repeat(60));
console.log("✅ Use Postman, Thunder Client, or curl to test these APIs");
console.log("=".repeat(60));

console.log("\n💡 Example curl command:");
console.log("-".repeat(60));
console.log(`curl -X PUT "${API_URL}/api/final-contracts/<contract_id>/extend" \\`);
console.log(`  -H "Authorization: Bearer <token>" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"extensionMonths": 6}'`);

console.log("\n\n📝 For interactive testing with database:");
console.log("-".repeat(60));
console.log("Run: node scripts/extend-contract-manual.js");
console.log("(Make sure MONGODB_URI is set in .env file)\n");
