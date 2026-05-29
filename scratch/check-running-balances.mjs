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

  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', uid).single()
  const initialBalance = settings?.initial_balance || 0

  const { data: txs } = await supabase
    .from('transactions')
    .select('date, amount, type, description')
    .eq('user_id', uid)
    .order('date', { ascending: true })

  console.log(`Initial balance: ${initialBalance}`)
  let running = initialBalance
  txs.forEach((t, i) => {
    const amt = Number(t.amount)
    if (t.type === 'income') {
      running += amt
    } else {
      running -= amt
    }
    // Print every 20th transaction or the last ones
    if (i < 10 || i > txs.length - 15) {
      console.log(`[${i}] ${t.date} | ${t.type === 'income' ? '+' : '-'}${amt.toFixed(2).padStart(8)} | Running: ${running.toFixed(2).padStart(8)} | ${t.description}`)
    } else if (i === 10) {
      console.log('...')
    }
  })
}

run().catch(console.error)
