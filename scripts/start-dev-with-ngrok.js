#!/usr/bin/env node

/**
 * Script để chạy cả backend và ngrok cùng lúc
 * 
 * Cách dùng:
 * npm run dev:all
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting backend server...\n');

// Start backend
const backend = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true,
  cwd: path.join(__dirname, '..')
});

// Forward backend output
backend.stdout.on('data', (data) => {
  process.stdout.write(data);
});

backend.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Đợi backend start (5 giây để đảm bảo server đã sẵn sàng)
setTimeout(() => {
  console.log('\n🌐 Starting ngrok tunnel...\n');
  
  // Start ngrok
  const ngrok = spawn('npm', ['run', 'ngrok'], {
    stdio: 'pipe',
    shell: true,
    cwd: path.join(__dirname, '..')
  });

  // Forward ngrok output
  ngrok.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  ngrok.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // Handle ngrok exit
  ngrok.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n⚠️  Ngrok exited with code ${code}`);
    }
  });
}, 5000);

// Handle exit signals
const cleanup = () => {
  console.log('\n\n🛑 Stopping backend and ngrok...');
  backend.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Handle backend exit
backend.on('exit', (code) => {
  console.log(`\nBackend exited with code ${code}`);
  process.exit(code || 0);
});

