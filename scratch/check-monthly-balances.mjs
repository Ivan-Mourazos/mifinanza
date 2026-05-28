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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)

  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  // Real Statement Balances
  // Jan: start = 29.20 (before first tx of -8.05 yielding 21.15), end = 196.35
  // Feb: start = 196.35, end = 208.05
  // Mar: start = 208.05, end = 1533.30
  // Apr: start = 1533.30, end = 1325.31
  // May (Excel): start = 1285.31 (before first tx of -20 yielding 1265.31), end = 170.16

  const statementBounds = {
    '2026-01': { start: 29.20, end: 196.35 },
    '2026-02': { start: 196.35, end: 208.05 },
    '2026-03': { start: 208.05, end: 1533.30 },
    '2026-04': { start: 1533.30, end: 1325.31 },
    '2026-05': { start: 1285.31, end: 170.16 }
  }

  const monthlySums = {}
  txs.forEach(t => {
    const month = t.date.slice(0, 7)
    const val = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
    monthlySums[month] = (monthlySums[month] || 0) + val
  })

  console.log("--- MONTHLY BALANCES AUDIT ---")
  Object.keys(statementBounds).forEach(month => {
    const bounds = statementBounds[month]
    const sum = monthlySums[month] || 0
    const expectedDiff = bounds.end - bounds.start
    const discrepancy = sum - expectedDiff
    console.log(`Month: ${month}`)
    console.log(`  Real Statement Start:  ${bounds.start.toFixed(2)}`)
    console.log(`  Real Statement End:    ${bounds.end.toFixed(2)}`)
    console.log(`  Expected Net Change:   ${expectedDiff.toFixed(2)}`)
    console.log(`  Sum of Parsed TXs:     ${sum.toFixed(2)}`)
    console.log(`  Discrepancy:           ${discrepancy.toFixed(2)}`)
  })
}

run()
