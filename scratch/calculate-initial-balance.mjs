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

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    console.error("Error fetching transactions:", error)
    process.exit(1)
  }

  let totalIncome = 0
  let totalExpense = 0

  txs.forEach(t => {
    const amt = Number(t.amount)
    if (t.type === 'income') {
      totalIncome += amt
    } else {
      totalExpense += amt
    }
  })

  const netBalance = totalIncome - totalExpense
  const targetFinalBalance = 170.16 // From Excel newest row

  const impliedInitialBalance = targetFinalBalance - netBalance

  console.log(`Total transactions in DB: ${txs.length}`)
  console.log(`Total Incomes: ${totalIncome}`)
  console.log(`Total Expenses: ${totalExpense}`)
  console.log(`Net transaction balance: ${netBalance}`)
  console.log(`Target final balance (May 28th): ${targetFinalBalance}`)
  console.log(`Implied initial balance (before Jan 2nd): ${impliedInitialBalance}`)
}

run()
