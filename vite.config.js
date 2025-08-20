import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0', // Essential for tunnel access
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '.trycloudflare.com', // Allow all trycloudflare subdomains
      '192.168.68.142', // Your local IP
    ],
    headers: {
      // Allow cross-origin requests from tunnel URLs
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        // Log proxy activity for debugging
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`🔄 Proxying: ${req.method} ${req.url} -> http://localhost:3001${req.url}`);
          });
        },
      }
    }
  }
})