"use client"

import { useState, useEffect } from "react"

export default function TunnelDisplay() {
  const [networkInfo, setNetworkInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Check if we're in Electron
    if (window.electronAPI) {
      // Get initial network info
      window.electronAPI.getNetworkInfo().then(setNetworkInfo)

      // Listen for tunnel URL updates
      window.electronAPI.onTunnelUrlUpdate((url) => {
        setNetworkInfo((prev) => ({ ...prev, tunnelUrl: url }))
      })

      return () => {
        window.electronAPI.removeTunnelUrlListener()
      }
    }
  }, [])

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  if (!networkInfo || !window.electronAPI) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 max-w-sm z-50 border">
      <h3 className="font-semibold text-gray-800 mb-3">🌐 Network Access</h3>

      {networkInfo.tunnelUrl && (
        <div className="mb-3">
          <label className="text-xs text-gray-600 block mb-1">Cloudflare Tunnel (Public)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={networkInfo.tunnelUrl}
              readOnly
              className="text-xs bg-gray-50 border rounded px-2 py-1 flex-1 font-mono"
            />
            <button
              onClick={() => copyToClipboard(networkInfo.tunnelUrl)}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="text-xs text-gray-600 block mb-1">Local Network</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={networkInfo.networkApiUrl}
            readOnly
            className="text-xs bg-gray-50 border rounded px-2 py-1 flex-1 font-mono"
          />
          <button
            onClick={() => copyToClipboard(networkInfo.networkApiUrl)}
            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <div>Local: {networkInfo.localApiUrl}</div>
        <div>Network IP: {networkInfo.networkIP}</div>
      </div>
    </div>
  )
}
