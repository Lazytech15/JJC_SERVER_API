import { spawn } from 'child_process';

console.log('🚀 Starting FetchData with Cloudflare Tunnel...\n');

// Set environment variable for tunnel mode
process.env.USE_TUNNEL = 'true';

// Start Electron using npx (more reliable cross-platform)
const electronProcess = spawn('npx', ['electron', '.'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, USE_TUNNEL: 'true' },
  shell: true
});

electronProcess.on('error', (error) => {
  console.error('❌ Failed to start Electron:', error);
  console.error('💡 Make sure Electron is installed: npm install electron --save-dev');
  process.exit(1);
});

electronProcess.on('close', (code) => {
  console.log(`\n📱 Electron process exited with code ${code}`);
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  electronProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  electronProcess.kill('SIGTERM');
});