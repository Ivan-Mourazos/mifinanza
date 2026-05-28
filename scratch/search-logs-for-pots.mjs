import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const logPath = resolve('C:\\Users\\Ivan_\\.gemini\\antigravity-ide\\brain\\813cb828-96b4-471d-bda8-762997283638\\.system_generated\\logs\\transcript.jsonl')

if (!existsSync(logPath)) {
  console.error("Log file not found")
  process.exit(1)
}

const fileContent = readFileSync(logPath, 'utf8')
const lines = fileContent.split('\n')

console.log("Searching logs for saving pots and settings inserts/calls...")

lines.forEach((line, index) => {
  if (!line.trim()) return
  try {
    const obj = JSON.parse(line)
    const str = JSON.stringify(obj).toLowerCase()
    
    if (str.includes("savepotmovement") || str.includes("savesavingpot") || str.includes("saveinitialbalance") || str.includes("saving_pots") || str.includes("user_settings") || str.includes("saving_pot_movements")) {
      // If the string contains database records or numbers, let's print them
      if (str.includes("amount") || str.includes("balance") || str.includes("target")) {
        console.log(`\n--- Line ${index} (type: ${obj.type}, source: ${obj.source}) ---`)
        if (obj.content) console.log("Content snippet:", obj.content.substring(0, 1000))
        if (obj.tool_calls) console.log("Tool calls:", JSON.stringify(obj.tool_calls).substring(0, 1000))
        if (obj.output) console.log("Output snippet:", String(obj.output).substring(0, 1000))
      }
    }
  } catch (err) {
    // Ignore
  }
})
