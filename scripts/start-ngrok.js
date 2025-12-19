#!/usr/bin/env node

/**
 * Script để start ngrok và tự động lấy URL cho IPN/Callback
 * 
 * Cách dùng:
 * 1. Cài ngrok: npm install -g ngrok hoặc download từ https://ngrok.com
 * 2. Chạy: node scripts/start-ngrok.js
 * 3. Copy các URL được hiển thị và set vào .env file
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN || '';

// Kiểm tra ngrok config (authtoken có thể đã được set bằng ngrok config add-authtoken)
try {
  execSync('ngrok config check', { stdio: 'ignore' });
} catch (error) {
  // Nếu config chưa có, kiểm tra authtoken trong env
  if (!NGROK_AUTH_TOKEN) {
    console.error('❌ Ngrok authtoken chưa được set!');
    console.log('\n📋 Cách set authtoken:');
    console.log('1. Truy cập: https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('2. Copy authtoken');
    console.log('3. Chạy lệnh: ngrok config add-authtoken YOUR_AUTHTOKEN\n');
    process.exit(1);
  }
}

// Kiểm tra ngrok đã cài chưa
function checkNgrokInstalled() {
  try {
    execSync('ngrok version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Lấy ngrok URL từ API
function getNgrokUrl() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.tunnels && json.tunnels.length > 0) {
            const httpsTunnel = json.tunnels.find(t => t.proto === 'https');
            resolve(httpsTunnel ? httpsTunnel.public_url : json.tunnels[0].public_url);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => {
      resolve(null);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Kiểm tra và dừng các ngrok tunnel đang chạy
function stopExistingTunnels() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.tunnels && json.tunnels.length > 0) {
            console.log(`⚠️  Phát hiện ${json.tunnels.length} tunnel đang chạy. Đang dừng...`);
            // Tìm và kill process ngrok
            try {
              // Thử nhiều cách để dừng ngrok trên các OS khác nhau
              if (process.platform === 'darwin' || process.platform === 'linux') {
                execSync('pkill -f ngrok || killall ngrok || true', { stdio: 'ignore' });
              } else if (process.platform === 'win32') {
                execSync('taskkill /F /IM ngrok.exe 2>nul || exit 0', { stdio: 'ignore', shell: true });
              }
              // Đợi một chút để process dừng hoàn toàn
              setTimeout(() => resolve(true), 1500);
            } catch (e) {
              // Nếu không dừng được bằng pkill, vẫn tiếp tục
              setTimeout(() => resolve(true), 1500);
            }
          } else {
            resolve(false);
          }
        } catch (e) {
          resolve(false);
        }
      });
    });
    req.on('error', () => {
      // Không có ngrok API đang chạy, không có tunnel nào cần dừng
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start ngrok
async function startNgrok() {
  // Dừng các tunnel cũ trước
  await stopExistingTunnels();
  
  console.log('🚀 Starting ngrok...\n');
  
  const args = ['http', PORT.toString()];
  
  // Không cần --authtoken nếu đã set bằng ngrok config add-authtoken
  // Chỉ thêm nếu có trong env variable
  if (NGROK_AUTH_TOKEN) {
    args.push('--authtoken', NGROK_AUTH_TOKEN);
  }

  let hasError = false;
  let errorMessage = '';

  const ngrok = spawn('ngrok', args, {
    stdio: 'pipe',
    shell: true
  });

  ngrok.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('started tunnel') || output.includes('Forwarding')) {
      console.log(output);
    }
  });

  ngrok.stderr.on('data', (data) => {
    const error = data.toString();
    if (error.includes('ERR_NGROK')) {
      hasError = true;
      errorMessage = error;
      console.error('❌ Ngrok error:', error);
    } else if (error.trim()) {
      // Chỉ hiển thị lỗi thực sự, không hiển thị warning thông thường
      if (!error.includes('WARN') && !error.includes('INFO')) {
        console.error('❌ Ngrok error:', error);
      }
    }
  });

  ngrok.on('error', (error) => {
    hasError = true;
    console.error('❌ Failed to start ngrok:', error.message);
    process.exit(1);
  });

  // Đợi ngrok start và lấy URL
  setTimeout(() => {
    if (hasError) {
      console.log('\n❌ Ngrok failed to start!');
      if (errorMessage.includes('ERR_NGROK_334')) {
        console.log('\n💡 Giải pháp:');
        console.log('1. Dừng tất cả ngrok process: pkill -f ngrok');
        console.log('2. Hoặc đợi vài giây rồi thử lại');
        console.log('3. Hoặc sử dụng --pooling-enabled nếu muốn chạy nhiều tunnel cùng lúc\n');
      }
      return;
    }

    getNgrokUrl().then((url) => {
      if (url) {
        console.log('\n✅ Ngrok started successfully!\n');
        console.log('📋 Copy các URL sau vào file .env:\n');
        console.log(`# MoMo IPN URL`);
        console.log(`MOMO_IPN_URL=${url}/api/payment/momo/ipn\n`);
        console.log(`# ZaloPay Callback URL`);
        console.log(`ZALOPAY_CALLBACK_URL=${url}/api/payment/zalopay/callback\n`);
        console.log(`# VNPay IPN URL (nếu cần)`);
        console.log(`# VNP_IPN_URL=${url}/api/payment/vnpay/ipn\n`);
        console.log('⚠️  Lưu ý: URL này sẽ thay đổi mỗi lần restart ngrok (trừ khi dùng ngrok account)');
        console.log('⚠️  Để có URL cố định, đăng ký ngrok account và set NGROK_AUTH_TOKEN\n');
      } else {
        console.log('\n⏳ Đang chờ ngrok khởi động...');
        console.log('📋 Mở http://127.0.0.1:4040 để xem ngrok dashboard và lấy URL\n');
      }
    });
  }, 3000);

  // Handle process exit
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping ngrok...');
    ngrok.kill();
    process.exit(0);
  });

  return ngrok;
}

// Main
if (!checkNgrokInstalled()) {
  console.error('❌ Ngrok chưa được cài đặt!');
  console.log('\n📥 Cài đặt ngrok:');
  console.log('   npm install -g ngrok');
  console.log('   hoặc download từ: https://ngrok.com/download\n');
  console.log('💡 Sau khi cài, đăng ký account miễn phí tại https://dashboard.ngrok.com');
  console.log('   để lấy authtoken và có URL cố định\n');
  process.exit(1);
}

startNgrok();

