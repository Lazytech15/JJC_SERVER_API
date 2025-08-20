import { spawn } from "child_process"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, "..")

console.log("🚀 Starting production build process...")

// Function to run a command and return a promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Running: ${command} ${args.join(" ")}`)

    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      cwd: rootDir,
      ...options,
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on("error", (error) => {
      reject(error)
    })
  })
}

async function buildProduction() {
  try {
    console.log("🏗️  Building Electron application...")

    // Build the Electron app with installer
    await runCommand("npm", ["run", "electron:dist:win"])

    console.log("✅ Production build completed successfully!")
    console.log("📦 Installer package created in dist-electron/ directory")
    console.log("🎉 You can now distribute your application!")
  } catch (error) {
    console.error("❌ Production build failed:", error.message)
    process.exit(1)
  }
}

buildProduction()
