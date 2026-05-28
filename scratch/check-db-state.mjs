import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(path) {
  if (!existsSync(path)) return

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing supabase URL or service role key in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  
  if (!user) {
    console.error("User not found")
    process.exit(1)
  }

  console.log(`Checking DB State for user: ${user.id} (${email})`)

  // 1. Check user settings
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
  
  console.log("\n--- USER SETTINGS ---")
  if (settingsError) console.error("Error:", settingsError)
  else console.log(settings)

  // 2. Check saving pots
  const { data: pots, error: potsError } = await supabase
    .from('saving_pots')
    .select('*')
    .eq('user_id', user.id)
  
  console.log("\n--- SAVING POTS ---")
  if (potsError) console.error("Error:", potsError)
  else console.log(pots)

  // 3. Check saving pot movements
  const { data: potMoves, error: potMovesError } = await supabase
    .from('saving_pot_movements')
    .select('*')
    .eq('user_id', user.id)
  
  console.log("\n--- SAVING POT MOVEMENTS ---")
  if (potMovesError) console.error("Error:", potMovesError)
  else console.log(`Total movements: ${potMoves.length}`)

  // 4. Check transactions original_description count
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
  
  console.log("\n--- TRANSACTIONS ---")
  if (txError) console.error("Error:", txError)
  else {
    console.log(`Total transactions: ${txs.length}`)
    const nullOriginal = txs.filter(t => !t.original_description)
    console.log(`Transactions with original_description NULL or empty: ${nullOriginal.length}`)
    
    // Group by month
    const grouped = {}
    txs.forEach(t => {
      const month = t.date.slice(0, 7)
      grouped[month] = (grouped[month] || 0) + 1
    })
    console.log("Grouped by month:", grouped)
  }
}

run()
