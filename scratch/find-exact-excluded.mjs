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
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  const uid = user.id

  const { data: txs } = await supabase
    .from('transactions')
    .select('date, amount, type, description, category_id')
    .eq('user_id', uid)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')

  const expenses = txs.filter(t => t.type === 'expense').map(t => ({ ...t, amount: Number(t.amount) }))
  const target = 269.22

  console.log(`Searching for a subset of expenses that sums to EXACTLY ${target}...`)

  function findSubsetSum(arr, target, index = 0, currentSum = 0, path = []) {
    if (Math.abs(currentSum - target) < 0.005) {
      console.log(`Found exact match:`, path.map(p => `${p.date}: -${p.amount} (${p.description})`).join(', '))
      return
    }
    if (currentSum > target + 0.01) return
    if (index >= arr.length) return

    // Option 1: Include arr[index]
    findSubsetSum(arr, target, index + 1, currentSum + arr[index].amount, path.concat(arr[index]))

    // Option 2: Exclude arr[index]
    findSubsetSum(arr, target, index + 1, currentSum, path)
  }

  findSubsetSum(expenses, target)
  
  console.log('\nWhat if the refund/devolución of 36.75 is subtracted from expenses in the bank, meaning the excluded expenses sum is different?')
  // If the bank does: expenses = DB_expenses - Excluded_Expenses - Refund (36.75) = 1030.68
  // Then DB_expenses - Excluded_Expenses = 1030.68 + 36.75 = 1067.43
  // Excluded_Expenses = DB_expenses - 1067.43 = 1299.90 - 1067.43 = 232.47
  console.log(`Searching for a subset of expenses that sums to EXACTLY 232.47...`)
  findSubsetSum(expenses, 232.47)

  console.log('\nWhat if we also subtract the Transferencia (75.00) from expenses (e.g. as a negative expense)?')
  // Excluded_Expenses = DB_expenses - (1030.68 + 36.75 + 75.00) = 1299.90 - 1142.43 = 157.47
  console.log(`Searching for a subset of expenses that sums to EXACTLY 157.47...`)
  findSubsetSum(expenses, 157.47)
}

run().catch(console.error)
