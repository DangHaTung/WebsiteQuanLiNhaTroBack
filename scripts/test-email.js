// Test email sending
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });
// Load environment variables from .env file

console.log("=".repeat(60));
console.log("📧 TEST EMAIL SENDING");
console.log("=".repeat(60));
// Display email configuration (mask password)

console.log("\n📋 Email Config:");
console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
console.log("EMAIL_PORT:", process.env.EMAIL_PORT);
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "***" + process.env.EMAIL_PASS.slice(-4) : "NOT SET");
// Function to test email sending
async function testEmail() {
  try {
    // Import the email service
    const { sendPaymentLinkEmail } = await import("../src/services/email/notification.service.js");
    
    console.log("\n📤 Sending test email...");
    // Send a test payment link email
    const result = await sendPaymentLinkEmail({
      // Send to your email address
      to: process.env.EMAIL_USER, // Gửi cho chính mình để test
      fullName: "Test User",
      paymentUrl: "http://localhost:5173/public/payment/test123/token456",
      billId: "test123",
      amount: 3000000,
      roomNumber: "101",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    // Display the result
    if (result.success) {
      // Email sent successfully
      console.log("✅ Email sent successfully!");
      console.log("Message ID:", result.messageId);
    } else {
      console.log("❌ Email failed:", result.error || result.message);
      // Email sending failed
    }
    // End of try
  } catch (error) {
    // Handle unexpected errors
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
  // End of test
}

testEmail();
