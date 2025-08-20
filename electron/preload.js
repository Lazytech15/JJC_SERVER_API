const { contextBridge, ipcRenderer } = require("electron")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Get the current tunnel URL
  getTunnelUrl: () => ipcRenderer.invoke("get-tunnel-url"),

  getNetworkInfo: () => ipcRenderer.invoke("get-network-info"),

  // Reload the application
  reloadApp: () => ipcRenderer.invoke("reload-app"),

  // Updated method name to match what React app expects
  onTunnelUrlUpdated: (callback) => {
    ipcRenderer.on("tunnel-url-updated", (event, url) => callback(url))
  },

  onTunnelUrlUpdate: (callback) => {
    ipcRenderer.on("tunnel-url-updated", (event, url) => callback(url))
  },

  removeTunnelUrlListener: () => {
    ipcRenderer.removeAllListeners("tunnel-url-updated")
  },

  onTunnelLog: (callback) => {
    ipcRenderer.on("tunnel-log", (event, logData) => callback(logData))
  },

  onTunnelUrlFound: (callback) => {
    ipcRenderer.on("tunnel-url-found", (event, urlData) => callback(urlData))
  },

  removeTunnelLogListeners: () => {
    ipcRenderer.removeAllListeners("tunnel-log")
    ipcRenderer.removeAllListeners("tunnel-url-found")
    ipcRenderer.removeAllListeners("tunnel-url-updated")
  },

  // Check if we're running in Electron
  isElectron: true,

  // Get platform info
  platform: process.platform,

  // Version information
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
})

// Add some helpful debugging info
console.log("🔧 Electron preload script loaded")
console.log("🖥️ Platform:", process.platform)
console.log("⚡ Electron version:", process.versions.electron)