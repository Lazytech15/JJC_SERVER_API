import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object
let mainWindow;
let serverProcess;
let tunnelProcess;
let tunnelUrl = null;

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
      preload: path.join(__dirname, '/electron/preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
    show: false, // Don't show until ready
    titleBarStyle: 'default'
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus on the window
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    mainWindow.focus();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the appropriate URL
  loadApplication();
}

async function loadApplication() {
  const useTunnel = process.env.USE_TUNNEL === 'true';
  
  if (useTunnel) {
    console.log('🌐 Tunnel mode enabled - starting tunnel...');
    await startTunnelAndDetectUrl();
  } else {
    console.log('🏠 Local mode - serving built files...');
    await serveBuiltFiles();
  }
}

function serveBuiltFiles() {
  return new Promise((resolve) => {
    console.log('📦 Starting server for built files...');
    
    // Start the Express server
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    // Serve the built files using Vite preview
    const previewProcess = spawn('npm', ['run', 'preview'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    // Wait for servers to start, then load the app
    setTimeout(() => {
      const localUrl = 'http://localhost:4173'; // Vite preview default port
      console.log(`📱 Loading application: ${localUrl}`);
      mainWindow.loadURL(localUrl).catch(() => {
        // Fallback to port 5173 if 4173 doesn't work
        console.log('📱 Trying fallback port...');
        mainWindow.loadURL('http://localhost:5173');
      });
      resolve();
    }, 3000);
  });
}

function startLocalServer() {
  return new Promise((resolve) => {
    console.log('🚀 Starting local server...');
    
    // Start the Express server
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    // Start Vite dev server (or serve built files)
    const isDev = !fs.existsSync(path.join(process.cwd(), 'dist'));
    
    if (isDev) {
      console.log('🔧 Starting development server...');
      const viteProcess = spawn('npm', ['run', 'client'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      });
    } else {
      console.log('📦 Serving built files...');
      const previewProcess = spawn('npm', ['run', 'preview'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      });
    }

    resolve();
  });
}

function startTunnelAndDetectUrl() {
  return new Promise((resolve, reject) => {
    console.log('🌐 Starting Cloudflare tunnel...');
    
    // First start the local server
    serveBuiltFiles();
    
    // Wait for local server to be ready, then start tunnel
    setTimeout(() => {
      tunnelProcess = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:4173'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let urlDetected = false;
      
      // Listen to tunnel output to detect the URL
      tunnelProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Tunnel stdout:', output);
        
        // Look for the tunnel URL in the output
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !urlDetected) {
          tunnelUrl = urlMatch[0];
          urlDetected = true;
          console.log(`🎉 Tunnel URL detected: ${tunnelUrl}`);
          
          // Load the tunnel URL in the main window
          mainWindow.loadURL(tunnelUrl).then(() => {
            console.log('✅ Application loaded successfully via tunnel');
            resolve();
          }).catch((error) => {
            console.error('❌ Failed to load tunnel URL:', error);
            // Fallback to local URL
            mainWindow.loadURL('http://localhost:4173');
            resolve();
          });
        }
      });

      tunnelProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('Tunnel stderr:', output);
        
        // Also check stderr for URL (sometimes it appears there)
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !urlDetected) {
          tunnelUrl = urlMatch[0];
          urlDetected = true;
          console.log(`🎉 Tunnel URL detected in stderr: ${tunnelUrl}`);
          
          mainWindow.loadURL(tunnelUrl).then(() => {
            console.log('✅ Application loaded successfully via tunnel');
            resolve();
          }).catch((error) => {
            console.error('❌ Failed to load tunnel URL:', error);
            mainWindow.loadURL('http://localhost:4173');
            resolve();
          });
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!urlDetected) {
          console.log('⚠️ Tunnel URL not detected, falling back to local URL');
          mainWindow.loadURL('http://localhost:4173');
          resolve();
        }
      }, 15000); // 15 second timeout

      tunnelProcess.on('error', (error) => {
        console.error('❌ Tunnel process error:', error);
        // Fallback to local URL
        mainWindow.loadURL('http://localhost:4173');
        resolve();
      });
      
    }, 4000); // Wait 4 seconds for server to start
  });
}

// App event listeners
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Clean up processes
  if (serverProcess) {
    serverProcess.kill();
  }
  if (tunnelProcess) {
    tunnelProcess.kill();
  }
  
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Clean up processes before quitting
  if (serverProcess) {
    console.log('🛑 Stopping server process...');
    serverProcess.kill();
  }
  if (tunnelProcess) {
    console.log('🛑 Stopping tunnel process...');
    tunnelProcess.kill();
  }
});

// IPC handlers
ipcMain.handle('get-tunnel-url', () => {
  return tunnelUrl;
});

ipcMain.handle('reload-app', () => {
  if (mainWindow) {
    mainWindow.reload();
  }
});

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Enable live reload for Electron in development
  try {
    const electronReload = await import('electron-reload');
    electronReload.default(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (e) {
    console.log('Electron reload not available');
  }
}