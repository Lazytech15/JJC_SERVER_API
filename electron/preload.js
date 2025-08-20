import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get the current tunnel URL
  getTunnelUrl: () => ipcRenderer.invoke('get-tunnel-url'),
  
  // Reload the application
  reloadApp: () => ipcRenderer.invoke('reload-app'),
  
  // Check if we're running in Electron
  isElectron: true,
  
  // Get platform info
  platform: process.platform,
  
  // Version information
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Add some helpful debugging info
console.log('🔧 Electron preload script loaded');
console.log('🖥️ Platform:', process.platform);
console.log('⚡ Electron version:', process.versions.electron);