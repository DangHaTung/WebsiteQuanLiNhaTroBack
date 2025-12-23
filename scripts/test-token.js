import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// Thiết lập đường dẫn __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load biến môi trường từ .env

dotenv.config({ path: path.join(__dirname, "../.env") });


// Paste token từ localStorage vào đây để test
const testToken = process.argv[2];
// Example: node scripts/test-token.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
if (!testToken) {
  console.log("Usage: node scripts/test-token.js <YOUR_TOKEN>");
  console.log("\nĐể lấy token:");
  console.log("1. Mở Console (F12)");
  console.log("2. Chạy: localStorage.getItem('admin_token')");
  console.log("3. Copy token và chạy: node scripts/test-token.js <token>");
  process.exit(1);
}
// Kiểm tra token
console.log("🔍 Testing token...");
console.log("JWT_SECRET:", process.env.JWT_SECRET);
console.log("Token (first 50 chars):", testToken.substring(0, 50) + "...");
// Giải mã và kiểm tra token
try {
  const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
  console.log("\n✅ Token hợp lệ!");
  console.log("Decoded:", JSON.stringify(decoded, null, 2));
  // Tính thời gian còn lại
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = decoded.exp - now;
  console.log(`\n⏰ Token còn ${Math.floor(timeLeft / 86400)} ngày ${Math.floor((timeLeft % 86400) / 3600)} giờ`);
  // Gợi ý nếu token sắp hết hạn
} catch (error) {
  console.log("\n❌ Token không hợp lệ!");
  console.log("Error:", error.message);
  // Gợi ý dựa trên loại lỗi
  if (error.name === "TokenExpiredError") {
    console.log("\n💡 Token đã hết hạn. Vui lòng đăng nhập lại.");
  } else if (error.name === "JsonWebTokenError") {
    // Có thể do JWT_SECRET không khớp
    console.log("\n💡 Token không đúng định dạng hoặc JWT_SECRET không khớp.");
  }
}// Kết thúc kiểm tra
