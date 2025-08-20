"use client"

import { useState, useEffect } from "react"
import "./App.css"

function App() {
  const [tunnelUrl, setTunnelUrl] = useState("")
  const [serverStatus, setServerStatus] = useState("starting")
  const [copySuccess, setCopySuccess] = useState(false)
  const [apiEndpoints, setApiEndpoints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasTunnel, setHasTunnel] = useState(false)

  // Function to read tunnel info from .tunnel-info file
  const readTunnelInfo = async () => {
    try {
      // Try to read the .tunnel-info file from the current directory
      if (window.fs && window.fs.readFile) {
        try {
          const tunnelInfoData = await window.fs.readFile('.tunnel-info', { encoding: 'utf8' })
          const tunnelInfo = JSON.parse(tunnelInfoData.trim())
          console.log("[v0] Read tunnel info from file:", tunnelInfo)
          
          // Return the tunnel info
          return {
            tunnelUrl: tunnelInfo.tunnel_url || tunnelInfo.url,
            localApiUrl: tunnelInfo.local_url || tunnelInfo.local_api_url || "http://localhost:3001",
            hasTunnel: !!(tunnelInfo.tunnel_url || tunnelInfo.url),
            port: tunnelInfo.port || 3001
          }
        } catch (fileError) {
          console.log("[v0] Could not read .tunnel-info file:", fileError.message)
          // Fallback to default values
          return {
            tunnelUrl: "http://localhost:3001",
            localApiUrl: "http://localhost:3001", 
            hasTunnel: false,
            port: 3001
          }
        }
      }
      
      // If window.fs is not available, return default
      return {
        tunnelUrl: "http://localhost:3001",
        localApiUrl: "http://localhost:3001",
        hasTunnel: false,
        port: 3001
      }
    } catch (error) {
      console.error("[v0] Error reading tunnel info:", error)
      return {
        tunnelUrl: "http://localhost:3001", 
        localApiUrl: "http://localhost:3001",
        hasTunnel: false,
        port: 3001
      }
    }
  }

  useEffect(() => {
    const getNetworkInfo = async () => {
      if (window.electronAPI) {
        try {
          const networkInfo = await window.electronAPI.getNetworkInfo()
          console.log("[v0] Received network info:", networkInfo) // Debug log

          const baseUrl = networkInfo.tunnelUrl || networkInfo.localApiUrl || "http://localhost:3001"
          setTunnelUrl(baseUrl)
          setHasTunnel(networkInfo.hasTunnel || false)

          if (networkInfo.hasTunnel) {
            setServerStatus("running")
          } else {
            setServerStatus("local")
          }

          generateApiEndpoints(baseUrl)
          setIsLoading(false)
        } catch (error) {
          console.error("Error getting network info:", error)
          // Fallback to reading tunnel info file
          const tunnelInfo = await readTunnelInfo()
          const baseUrl = tunnelInfo.hasTunnel ? tunnelInfo.tunnelUrl : tunnelInfo.localApiUrl
          
          setTunnelUrl(baseUrl)
          setServerStatus(tunnelInfo.hasTunnel ? "running" : "local")
          setHasTunnel(tunnelInfo.hasTunnel)
          generateApiEndpoints(baseUrl)
          setIsLoading(false)
        }
      } else {
        // No electronAPI available, read from tunnel info file
        const tunnelInfo = await readTunnelInfo()
        const baseUrl = tunnelInfo.hasTunnel ? tunnelInfo.tunnelUrl : tunnelInfo.localApiUrl
        
        setTunnelUrl(baseUrl)
        setServerStatus(tunnelInfo.hasTunnel ? "running" : "local")
        setHasTunnel(tunnelInfo.hasTunnel)
        generateApiEndpoints(baseUrl)
        setIsLoading(false)
      }
    }

    // Initial network info fetch
    getNetworkInfo()

    if (window.electronAPI) {
      // Listen for tunnel URL updates from the main process
      window.electronAPI.onTunnelUrlUpdated((newTunnelUrl) => {
        console.log("🎉 [TUNNEL URL UPDATED]:", newTunnelUrl)
        setTunnelUrl(newTunnelUrl)
        setHasTunnel(newTunnelUrl && newTunnelUrl.includes(".trycloudflare.com"))
        setServerStatus(newTunnelUrl && newTunnelUrl.includes(".trycloudflare.com") ? "running" : "local")
        generateApiEndpoints(newTunnelUrl)
        setIsLoading(false)
      })

      // Listen for tunnel logs and display them in browser console
      window.electronAPI.onTunnelLog((logData) => {
        console.log(`[TUNNEL ${logData.type.toUpperCase()}] ${logData.timestamp}:`, logData.message)
      })

      // Listen for tunnel URL detection and highlight it
      window.electronAPI.onTunnelUrlFound((urlData) => {
        console.log(`🎉 [TUNNEL URL DETECTED] ${urlData.timestamp}:`, urlData.url)
        console.log(`📋 [FULL LOG]:`, urlData.fullLog)

        // Filter and extract just the URL for easy copying
        const urlMatch = urlData.fullLog.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i)
        if (urlMatch) {
          console.log(`🔗 [EXTRACTED URL]:`, urlMatch[1])
        }
      })
    }

    // Set up interval to periodically check network info and re-read tunnel file
    const interval = setInterval(async () => {
      if (!window.electronAPI) {
        // If no electronAPI, periodically check the tunnel info file
        const tunnelInfo = await readTunnelInfo()
        const baseUrl = tunnelInfo.hasTunnel ? tunnelInfo.tunnelUrl : tunnelInfo.localApiUrl
        
        // Only update if the URL has changed
        if (baseUrl !== tunnelUrl) {
          setTunnelUrl(baseUrl)
          setServerStatus(tunnelInfo.hasTunnel ? "running" : "local")
          setHasTunnel(tunnelInfo.hasTunnel)
          generateApiEndpoints(baseUrl)
        }
      } else {
        // If electronAPI is available, use the existing method
        getNetworkInfo()
      }
    }, 10000) // Every 10 seconds

    return () => {
      clearInterval(interval)
      if (window.electronAPI) {
        window.electronAPI.removeTunnelLogListeners()
      }
    }
  }, [tunnelUrl]) // Add tunnelUrl as dependency to avoid infinite loops

  const generateApiEndpoints = (baseUrl) => {
    const endpoints = [
      {
        method: "GET",
        path: "/api/employees",
        description: "Get all employees",
        example: `curl -X GET "${baseUrl}/api/employees"`,
      },
      {
        method: "POST",
        path: "/api/employees",
        description: "Create new employee",
        example: `curl -X POST "${baseUrl}/api/employees" \\
  -H "Content-Type: application/json" \\
  -d '{"uid": 1, "first_name": "John", "last_name": "Doe", "username": "johndoe", "access_level": "admin"}'`,
      },
      {
        method: "PUT",
        path: "/api/employees/:uid",
        description: "Update employee by UID",
        example: `curl -X PUT "${baseUrl}/api/employees/1" \\
  -H "Content-Type: application/json" \\
  -d '{"first_name": "Jane", "last_name": "Smith"}'`,
      },
      {
        method: "DELETE",
        path: "/api/employees/:uid",
        description: "Delete employee by UID",
        example: `curl -X DELETE "${baseUrl}/api/employees/1"`,
      },
      {
        method: "GET",
        path: "/api/employees/search/:query",
        description: "Search employees",
        example: `curl -X GET "${baseUrl}/api/employees/search/john"`,
      },
      {
        method: "GET",
        path: "/api/employees/access/:level",
        description: "Get employees by access level",
        example: `curl -X GET "${baseUrl}/api/employees/access/admin"`,
      },
      {
        method: "GET",
        path: "/api/stats",
        description: "Get database statistics",
        example: `curl -X GET "${baseUrl}/api/stats"`,
      },
      {
        method: "GET",
        path: "/api/access-levels",
        description: "Get all access levels",
        example: `curl -X GET "${baseUrl}/api/access-levels"`,
      },
    ]
    setApiEndpoints(endpoints)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error("Failed to copy: ", err)
    }
  }

  const getStatusInfo = () => {
    switch (serverStatus) {
      case "starting":
        return { color: "bg-yellow-100 text-yellow-800", text: "Starting Server & Tunnel..." }
      case "running":
        return { color: "bg-green-100 text-green-800", text: "Public Access" }
      case "local":
        return { color: "bg-blue-100 text-blue-800", text: "Running Locally" }
      default:
        return { color: "bg-gray-100 text-gray-800", text: "Unknown Status" }
    }
  }

  const statusInfo = getStatusInfo()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Starting Employee Database</h2>
          <p className="text-gray-600">Initializing server and reading tunnel configuration...</p>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Employee Database API</h1>
              <div className={`ml-4 px-3 py-1 rounded-full text-sm ${statusInfo.color}`}>{statusInfo.text}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg mb-8 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {hasTunnel ? "🌐 Public API Access" : "🏠 Local API Access"}
          </h2>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">API Base URL:</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={tunnelUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(tunnelUrl)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {copySuccess ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {hasTunnel ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-green-400">✓</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Your database is now publicly accessible!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      This URL can be accessed from anywhere on the internet. Share it with your team or use it in your
                      applications.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-blue-400">ℹ</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Running in local mode</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Your database is accessible locally. To enable public access, restart with tunnel mode enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg mb-8 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🔍 Tunnel Configuration</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-400">💡</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Reading Configuration</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    The application reads tunnel configuration from the <code className="bg-blue-100 px-1 rounded">.tunnel-info</code> file in the root directory.
                  </p>
                  <p className="mt-1">
                    This file should contain JSON with tunnel URL and local API configuration. The app automatically refreshes every 10 seconds to check for updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">📚 API Endpoints</h2>
            <p className="mt-1 text-sm text-gray-600">Use these endpoints to interact with your employee database</p>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {apiEndpoints.map((endpoint, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        endpoint.method === "GET"
                          ? "bg-green-100 text-green-800"
                          : endpoint.method === "POST"
                            ? "bg-blue-100 text-blue-800"
                            : endpoint.method === "PUT"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <code className="text-sm font-mono text-gray-900">{endpoint.path}</code>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{endpoint.description}</p>

                  <div className="bg-gray-900 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Example:</span>
                      <button
                        onClick={() => copyToClipboard(endpoint.example)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-sm text-green-400 overflow-x-auto">
                      <code>{endpoint.example}</code>
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">🚀 Quick Start</h2>
          </div>

          <div className="p-6">
            <div className="prose max-w-none">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Getting Started</h3>

              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Copy the API Base URL above</li>
                <li>Use any HTTP client (curl, Postman, fetch, etc.) to make requests</li>
                <li>All endpoints return JSON responses</li>
                <li>POST and PUT requests require Content-Type: application/json header</li>
              </ol>

              <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">Employee Data Structure</h3>

              <div className="bg-gray-900 rounded-md p-4">
                <pre className="text-sm text-green-400">
                  {`{
  "uid": 1,
  "first_name": "John",
  "last_name": "Doe", 
  "middle_name": "William",
  "username": "johndoe",
  "access_level": "admin",
  "password_salt": "optional",
  "password_hash": "optional",
  "tfa_salt": "optional", 
  "tfa_hash": "optional"
}`}
                </pre>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">Testing Your API</h3>

              <p className="text-sm text-gray-700 mb-3">Try this command to test your API connection:</p>

              <div className="bg-gray-900 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Test Connection:</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X GET "${tunnelUrl}/api/stats"`)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-sm text-green-400">
                  <code>{`curl -X GET "${tunnelUrl}/api/stats"`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App