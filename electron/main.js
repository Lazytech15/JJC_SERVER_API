import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import { spawn } from "child_process"
import fs from "fs"
import { fileURLToPath } from "url"
import http from "http"
import { networkInterfaces } from "os"
import fetch from "node-fetch"

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORTS = {
  API: 3001,
  CLIENT_DEV: 5173,
  CLIENT_PREVIEW: 4173,
  UNIFIED: 3001, // Use API server for all environments
}

// Keep a global reference of the window object
let mainWindow
let serverProcess
let tunnelProcess
let tunnelUrl = null

// Helper function to get local network IP
function getLocalNetworkIP() {
  const interfaces = networkInterfaces()

  for (const interfaceName of Object.keys(interfaces)) {
    const networkInterface = interfaces[interfaceName]
    for (const alias of networkInterface) {
      if (alias.family === "IPv4" && !alias.internal && alias.address !== "127.0.0.1") {
        return alias.address
      }
    }
  }

  return "localhost" // fallback
}

// Helper function to check if a server is running on a specific host and port
function checkServerRunning(host, port) {
  return new Promise((resolve) => {
    const req = http
      .get(`http://${host}:${port}`, (res) => {
        resolve(true)
      })
      .on("error", () => {
        resolve(false)
      })

    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// Helper function to test if a URL is accessible
async function testUrlAccessibility(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { method: "HEAD", timeout: 5000 })
      if (response.ok) {
        console.log(`✅ URL is accessible: ${url}`)
        return true
      }
    } catch (error) {
      console.log(`❌ Attempt ${i + 1}: URL not accessible: ${url}`)
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds before retry
      }
    }
  }
  return false
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../assets/icon.ico"),
    show: false, // Don't show until ready
    titleBarStyle: "default",
  })

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()

    // Focus on the window
    if (process.platform === "darwin") {
      app.dock.show()
    }
    mainWindow.focus()
  })

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null
  })

  // Load the appropriate URL
  loadApplication()
}

async function loadApplication() {
  // Check if we have a built version (production mode)
  const distExists = fs.existsSync(path.join(process.cwd(), "dist"))
  const isProduction = distExists && process.env.NODE_ENV !== "development"
  const useTunnel = isProduction || process.env.USE_TUNNEL === "true"
  const networkIP = getLocalNetworkIP()

  console.log(`📋 Application mode: ${isProduction ? "Production" : "Development"}`)
  console.log(`🌐 Network IP detected: ${networkIP}`)
  console.log(`🚇 Use tunnel: ${useTunnel}`)

  const apiServerRunning = await checkServerRunning("localhost", PORTS.API)
  const clientServerRunning = await checkServerRunning("localhost", PORTS.CLIENT_DEV)
  const previewServerRunning = await checkServerRunning("localhost", PORTS.CLIENT_PREVIEW)

  console.log(`🔍 Server status check:`)
  console.log(`   - API server (${PORTS.API}): ${apiServerRunning ? "✅ Running" : "❌ Not running"}`)
  console.log(`   - Client dev (${PORTS.CLIENT_DEV}): ${clientServerRunning ? "✅ Running" : "❌ Not running"}`)
  console.log(
    `   - Client preview (${PORTS.CLIENT_PREVIEW}): ${previewServerRunning ? "✅ Running" : "❌ Not running"}`,
  )

  if (useTunnel) {
    console.log("🌐 Production mode - starting tunnel first...")
    await startTunnelAndDetectUrl(networkIP, isProduction)
  } else {
    console.log("🏠 Development mode - using local servers...")
    await loadWithExistingServices(apiServerRunning, networkIP, isProduction)
  }
}

async function loadWithExistingServices(apiRunning, networkIP, isProduction) {
  // Always ensure API server is running as it serves both API and static files
  if (!apiRunning) {
    console.log("🚀 Starting unified API server...")
    serverProcess = spawn("node", ["server/index.js"], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: PORTS.API.toString(),
        HOST: "0.0.0.0",
      },
    })

    // Wait for API server to start
    await new Promise((resolve) => setTimeout(resolve, 3000))
  } else {
    console.log("✅ Using existing API server")
  }

  const targetUrl = tunnelUrl || `http://localhost:${PORTS.API}`
  console.log(`📱 Loading application: ${targetUrl}`)

  try {
    await mainWindow.loadURL(targetUrl)
    console.log("✅ Application loaded successfully")
  } catch (error) {
    console.error("❌ Failed to load app:", error)
  }
}

function startTunnelAndDetectUrl(networkIP, isProduction) {
  return new Promise(async (resolve, reject) => {
    console.log("🌐 Starting Cloudflare tunnel...")
    console.log(`🌐 Using network IP: ${networkIP}`)

    // Clean up old tunnel info file first
    cleanupTunnelInfo()

    // Start the API server first
    if (!serverProcess) {
      console.log("🚀 Starting unified API server...")
      serverProcess = spawn("node", ["server/index.js"], {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
          ...process.env,
          PORT: PORTS.API.toString(),
          HOST: "0.0.0.0",
        },
      })
    }

    // Wait for local server to be ready, then start tunnel
    setTimeout(() => {
      const tunnelTarget = `http://${networkIP}:${PORTS.API}`
      console.log(`🚇 Tunnel target: ${tunnelTarget}`)

      tunnelProcess = spawn("cloudflared", ["tunnel", "--url", tunnelTarget], {
        stdio: ["ignore", "pipe", "pipe"],
      })

      let urlDetected = false

      // Listen to tunnel output to detect the URL
      tunnelProcess.stdout.on("data", (data) => {
        const output = data.toString()
        console.log("[TUNNEL stdout]:", output)

        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send("tunnel-log", {
            type: "stdout",
            message: output,
            timestamp: new Date().toISOString(),
          })
        }

        const urlMatch = output.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i)
        if (urlMatch && !urlDetected) {
          tunnelUrl = urlMatch[1]
          urlDetected = true
          console.log(`🎉 Tunnel URL detected from stdout: ${tunnelUrl}`)

          // Save tunnel URL to file for future reference
          saveTunnelUrl(tunnelUrl)
          
          // Load the application with the new tunnel URL
          loadApplicationWithTunnelUrl()
          resolve()
        }
      })

      tunnelProcess.stderr.on("data", (data) => {
        const output = data.toString()
        console.log("[TUNNEL stderr]:", output)

        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send("tunnel-log", {
            type: "stderr",
            message: output,
            timestamp: new Date().toISOString(),
          })

          // Check if this log contains the tunnel URL
          const urlMatch = output.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i)
          if (urlMatch) {
            mainWindow.webContents.send("tunnel-url-found", {
              url: urlMatch[1],
              fullLog: output,
              timestamp: new Date().toISOString(),
            })
          }
        }

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
            console.log(`🎉 Tunnel URL detected from stderr: ${tunnelUrl}`)

            // Save tunnel URL to file for future reference
            saveTunnelUrl(tunnelUrl)
            
            // Load the application with the new tunnel URL
            loadApplicationWithTunnelUrl()
            resolve()
            break
          }
        }
      })

      // Timeout fallback - also check for tunnel info file
      setTimeout(() => {
        if (!urlDetected) {
          console.log("⚠️ Tunnel URL not detected from output after 15 seconds, checking .tunnel-info file...")
          
          // Try to read from tunnel info file as fallback
          const tunnelFromFile = readTunnelUrlFromFile()
          if (tunnelFromFile) {
            tunnelUrl = tunnelFromFile
            console.log(`📁 Found tunnel URL in file: ${tunnelUrl}`)
            loadApplicationWithTunnelUrl()
            resolve()
          } else {
            console.log("⚠️ No tunnel URL found, falling back to local URL")
            console.log("[INFO] Check if cloudflared is installed and accessible")
            console.log(`[INFO] Tunnel was targeting: ${tunnelTarget}`)
            const localUrl = `http://localhost:${PORTS.API}`
            mainWindow.loadURL(localUrl).catch(() => {
              console.error("❌ Failed to load fallback URL")
            })
            resolve()
          }
        }
      }, 15000)

      tunnelProcess.on("error", (error) => {
        console.error("❌ Tunnel process error:", error)
        console.log(
          "[INFO] Make sure cloudflared is installed: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/",
        )
        // Fallback to local URL
        const localUrl = `http://localhost:${PORTS.API}`
        mainWindow.loadURL(localUrl).catch(() => {
          console.error("❌ Failed to load fallback URL")
        })
        resolve()
      })
    }, 4000)
  })
}

// Helper function to load application with tunnel URL
async function loadApplicationWithTunnelUrl() {
  console.log(`🔄 Testing tunnel accessibility: ${tunnelUrl}`)
  
  // Test if the tunnel URL is accessible
  const isAccessible = await testUrlAccessibility(tunnelUrl, 5)
  
  if (isAccessible) {
    console.log(`📱 Loading application via tunnel: ${tunnelUrl}`)
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("tunnel-url-updated", tunnelUrl)
    }

    try {
      await mainWindow.loadURL(tunnelUrl)
      console.log("✅ Application loaded successfully via tunnel")
    } catch (error) {
      console.error("❌ Failed to load tunnel URL, falling back to localhost:", error)
      const localUrl = `http://localhost:${PORTS.API}`
      await mainWindow.loadURL(localUrl)
    }
  } else {
    console.log("❌ Tunnel URL is not accessible, falling back to localhost")
    const localUrl = `http://localhost:${PORTS.API}`
    await mainWindow.loadURL(localUrl)
  }
}

// Helper function to read tunnel URL from file
function readTunnelUrlFromFile() {
  try {
    const tunnelInfoFile = path.join(process.cwd(), ".tunnel-info")
    if (fs.existsSync(tunnelInfoFile)) {
      const tunnelInfo = fs.readFileSync(tunnelInfoFile, "utf8").trim()
      const urlMatch = tunnelInfo.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i)
      return urlMatch ? urlMatch[1] : null
    }
  } catch (error) {
    console.log("Could not read tunnel info file:", error.message)
  }
  return null
}

// Helper function to save tunnel URL for future reference
function saveTunnelUrl(url) {
  try {
    const tunnelInfoFile = path.join(process.cwd(), ".tunnel-info")
    fs.writeFileSync(tunnelInfoFile, url, "utf8")
    console.log(`💾 Saved tunnel URL to ${tunnelInfoFile}`)
  } catch (error) {
    console.log("Could not save tunnel URL:", error.message)
  }
}

// Helper function to clean up tunnel info file
function cleanupTunnelInfo() {
  try {
    const tunnelInfoFile = path.join(process.cwd(), ".tunnel-info")
    if (fs.existsSync(tunnelInfoFile)) {
      fs.unlinkSync(tunnelInfoFile)
      console.log("🧹 Cleaned up old tunnel info file")
    }
  } catch (error) {
    console.log("Could not cleanup tunnel info file:", error.message)
  }
}

// App event listeners
app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  // Clean up processes only if we started them
  if (serverProcess) {
    console.log("🛑 Stopping server process...")
    serverProcess.kill()
  }
  if (tunnelProcess) {
    console.log("🛑 Stopping tunnel process...")
    tunnelProcess.kill()
  }

  cleanupTunnelInfo()

  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", () => {
  // Clean up processes before quitting only if we started them
  if (serverProcess) {
    console.log("🛑 Stopping server process...")
    serverProcess.kill()
  }
  if (tunnelProcess) {
    console.log("🛑 Stopping tunnel process...")
    tunnelProcess.kill()
  }

  cleanupTunnelInfo()
})

ipcMain.handle("get-tunnel-url", () => {
  console.log(`[IPC] Returning tunnel URL: ${tunnelUrl}`)
  return tunnelUrl
})

ipcMain.handle("get-network-info", () => {
  const networkIP = getLocalNetworkIP()
  return {
    tunnelUrl,
    networkIP,
    localApiUrl: `http://localhost:${PORTS.API}`,
    networkApiUrl: `http://${networkIP}:${PORTS.API}`,
    ports: PORTS,
    hasTunnel: tunnelUrl !== null && tunnelUrl.includes(".trycloudflare.com"),
  }
})

ipcMain.handle("reload-app", () => {
  if (mainWindow) {
    mainWindow.reload()
  }
})

// Development helpers
if (process.env.NODE_ENV === "development") {
  // Enable live reload for Electron in development
  try {
    const electronReload = await import("electron-reload")
    electronReload.default(__dirname, {
      electron: path.join(__dirname, "..", "node_modules", ".bin", "electron"),
      hardResetMethod: "exit",
    })
  } catch (e) {
    console.log("Electron reload not available")
  }
}