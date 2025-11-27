#!/bin/bash
# Script để kiểm tra ZaloPay payment status

echo "🔍 ZaloPay Payment Debug Tool"
echo "=============================="
echo ""

# Kiểm tra ngrok
echo "1. Kiểm tra ngrok:"
curl -s http://localhost:4040/api/tunnels | grep -o '"PublicURL":"[^"]*"' | head -1
echo ""

# Kiểm tra callback URL trong .env
echo "2. Callback URL trong .env:"
grep ZALOPAY_CALLBACK_URL .env 2>/dev/null | grep -v "^#" | head -1
echo ""

# Hướng dẫn
echo "3. Để kiểm tra payment status:"
echo "   - Xem logs backend: tìm '🔔 ZaloPay Callback received' hoặc '🔙 ZaloPay Return received'"
echo "   - Hoặc dùng script: node scripts/debug-zalopay-payment.js <transactionId>"
echo ""

echo "4. Test callback endpoint:"
echo "   curl -X POST https://imprudent-pneumatically-dylan.ngrok-free.dev/api/payment/zalopay/callback \\"
echo "     -H 'Content-Type: application/x-www-form-urlencoded' \\"
echo "     -d 'data=test&mac=test'"
echo ""

