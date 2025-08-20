// electron/sequential-launch.js
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { networkInterfaces } from 'os'
import http from 'http'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Get local network IP
function getLocalNetworkIP() {
  const interfaces = networkInterfaces()
  
  for (const interfaceName of Object.keys(interfaces)) {
    const networkInterface = interfaces[interfaceName]
    for (const alias of networkInterface) {
      if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
        return alias.address
      }
    }
  }
  
  return 'localhost' // fallback
}

// Helper function to check if a server is running
function checkServerRunning(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}`, (res) => {
      resolve(true)
    }).on('error', () => {
      resolve(false)
    })
    
    req.setTimeout(timeout, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// Helper function to wait for a server to be ready
async function waitForServer(host, port, maxWait = 30000) {
  const startTime = Date.now()
  console.log(`⏳ Waiting for server at ${host}:${port}...`)
  
  while (Date.now() - startTime < maxWait) {
    if (await checkServerRunning(host, port, 2000)) {
      console.log(`✅ Server ready at ${host}:${port}`)
      return true
    }
    await delay(1000)
  }
  
  console.log(`❌ Server at ${host}:${port} not ready after ${maxWait}ms`)
  return false
}

// Kill process by port (for cleanup)
async function killProcessByPort(port) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'ignore' })
    } else {
      const { spawn: spawnSync } = await import('child_process')
      spawnSync('pkill', ['-f', `${port}`], { stdio: 'ignore' })
    }
  } catch (error) {
    // Ignore errors in cleanup
  }
}

async function sequentialLaunch() {
  const networkIP = getLocalNetworkIP()
  console.log('🚀 Starting sequential launch process...')
  console.log(`🌐 Network IP detected: ${networkIP}`)
  
  // Clean up any existing tunnel info
  const tunnelInfoFile = path.join(process.cwd(), '.tunnel-info')
  if (fs.existsSync(tunnelInfoFile)) {
    fs.unlinkSync(tunnelInfoFile)
    console.log('🧹 Cleaned up existing tunnel info')
  }

  // Check for existing servers
  const apiServerRunning = await checkServerRunning('localhost', 3001)
  const previewServerRunning = await checkServerRunning('localhost', 4173)
  const devServerRunning = await checkServerRunning('localhost', 5173)

  console.log('🔍 Existing server check:')
  console.log(`   - API server (3001): ${apiServerRunning ? '✅ Running' : '❌ Not running'}`)
  console.log(`   - Preview server (4173): ${previewServerRunning ? '✅ Running' : '❌ Not running'}`)
  console.log(`   - Dev server (5173): ${devServerRunning ? '✅ Running' : '❌ Not running'}`)

  // Build the application if needed
  const distExists = fs.existsSync(path.join(process.cwd(), 'dist'))
  if (!distExists) {
    console.log('📦 Step 1: Building application...')
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true
    })

    await new Promise((resolve, reject) => {
      buildProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Build completed successfully')
          resolve()
        } else {
          console.error('❌ Build failed')
          reject(new Error('Build failed'))
        }
      })
    })
  } else {
    console.log('📦 Using existing build')
  }

  let serverProcess, previewProcess

  // Start API server if not running
  if (!apiServerRunning) {
    console.log('🚀 Step 2: Starting API server on network...')
    serverProcess = spawn('node', ['server/index.js'], {
      stdio: 'inherit',
      shell: true,
      detached: false,
      env: {
        ...process.env,
        PORT: '5500',
        HOST: '0.0.0.0' // Listen on all interfaces
      }
    })

    // Wait for API server to be ready
    const apiReady = await waitForServer('localhost', 3001, 15000)
    if (!apiReady) {
      console.error('❌ API server failed to start')
      process.exit(1)
    }
  } else {
    console.log('✅ Using existing API server')
  }

  // Start preview server if not running
  if (!previewServerRunning) {
    console.log('📦 Step 3: Starting preview server...')
    previewProcess = spawn('npm', ['run', 'preview'], {
      stdio: 'inherit', 
      shell: true,
      detached: false
    })

    // Wait for preview server to be ready
    const previewReady = await waitForServer('localhost', 4173, 15000)
    if (!previewReady) {
      console.log('⚠️ Preview server not ready, but continuing...')
    }
  } else {
    console.log('✅ Using existing preview server')
  }

  console.log('🌐 Step 4: Starting Cloudflare tunnel with network IP...')
  // Use network IP instead of localhost for tunnel
  const tunnelTarget = `http://${networkIP}:5500`
  console.log(`🚇 Tunnel target: ${tunnelTarget}`)
  
  const tunnelProcess = spawn('cloudflared', ['tunnel', '--url', tunnelTarget], {
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: false
  })

  let tunnelUrl = null
  let urlDetected = false

  // Listen for tunnel URL in stdout
  tunnelProcess.stdout.on('data', (data) => {
    const output = data.toString()
    console.log('[TUNNEL]', output)
    
    const urlMatch = output.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i)
    if (urlMatch && !urlDetected) {
      tunnelUrl = urlMatch[1]
      urlDetected = true
      console.log(`🎉 Tunnel URL detected: ${tunnelUrl}`)
      
      // Save tunnel URL to file
      try {
        fs.writeFileSync(tunnelInfoFile, tunnelUrl, 'utf8')
        console.log(`💾 Saved tunnel URL to .tunnel-info`)
      } catch (error) {
        console.error('Could not save tunnel URL:', error.message)
      }
    }
  })

  // Listen for tunnel URL in stderr
  tunnelProcess.stderr.on('data', (data) => {
    const output = data.toString()
    console.log('[TUNNEL ERROR]', output)

    const patterns = [
      /(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i,
      /Your quick Tunnel: (https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i,
      /Visit (https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i,
    ]

    for (const pattern of patterns) {
      const urlMatch = output.match(pattern)
      if (urlMatch && !urlDetected) {
        tunnelUrl = urlMatch[1] || urlMatch[0]
        urlDetected = true
        console.log(`🎉 Tunnel URL detected in stderr: ${tunnelUrl}`)
        
        // Save tunnel URL to file
        try {
          fs.writeFileSync(tunnelInfoFile, tunnelUrl, 'utf8')
          console.log(`💾 Saved tunnel URL to .tunnel-info`)
        } catch (error) {
          console.error('Could not save tunnel URL:', error.message)
        }
        break
      }
    }
  })

  // Wait for tunnel to be established
  await delay(8000)

  console.log('✅ All services started successfully!')
  if (urlDetected) {
    console.log(`🌐 Tunnel URL: ${tunnelUrl}`)
  }
  console.log(`🌐 Network accessible at: http://${networkIP}:3001`)
  console.log(`🏠 Local preview at: http://localhost:4173`)
  console.log('🖥️  Starting Electron automatically in 3 seconds...')
  
  // Auto-start Electron after services are ready
  setTimeout(() => {
    console.log('🚀 Starting Electron...')
    const electronProcess = spawn('npm', ['run', 'electron'], {
      stdio: 'inherit',
      shell: true,
      detached: true // Allow Electron to run independently
    })
    
    electronProcess.on('error', (error) => {
      console.error('❌ Failed to start Electron:', error)
    })
  }, 3000)

  // Keep the process running
  console.log('🔄 Keeping services running... Press Ctrl+C to stop')
  
  // Handle graceful shutdown
  const cleanup = () => {
    console.log('\n🛑 Shutting down services...')
    
    // Clean up tunnel info file
    if (fs.existsSync(tunnelInfoFile)) {
      fs.unlinkSync(tunnelInfoFile)
      console.log('🧹 Cleaned up tunnel info file')
    }
    
    // Kill processes
    if (serverProcess) serverProcess.kill()
    if (previewProcess) previewProcess.kill() 
    if (tunnelProcess) tunnelProcess.kill()
    
    console.log('✅ All services stopped')
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)
}

// Run the sequential launch
sequentialLaunch().catch((error) => {
  console.error('❌ Sequential launch failed:', error)
  process.exit(1)
})