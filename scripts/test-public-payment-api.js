import fetch from "node-fetch";

const billId = "691ff5107e05d12d00e42617";
const token = "32e1fde65999dc78741edac725184bdc4b30e546a21af7c090fdfb3d893786c7";
// Thay đổi URL nếu server không chạy trên localhost:3000
async function testAPI() {
  try {
    const url = `http://localhost:3000/api/public/payment/${billId}/${token}`;
    console.log("🔍 Testing API:", url);
    // Gửi yêu cầu GET cho API
    const response = await fetch(url);
    const data = await response.json();
    // Hiển thị kết quả
    console.log("\n📊 Response Status:", response.status);
    console.log("📊 Response Data:", JSON.stringify(data, null, 2));
    // Kiểm tra kết quả
    if (data.success) {
      console.log("\n✅ API returned success");
      console.log("Bill Status:", data.data?.bill?.status);
    } else {
      console.log("\n❌ API returned error");
      console.log("Error Message:", data.message);
    }
    // Kết thúc test
  } catch (error) {
    // Hành động khi xây ra lỗi
    console.error("❌ Error:", error.message);
  }
  // Kết thúc hàm
}

testAPI();
