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

  // Load transactions between 2026-04-20 and 2026-05-05
  const { data: txs } = await supabase
    .from('transactions')
    .select('date, amount, type, description')
    .eq('user_id', uid)
    .gte('date', '2026-04-20')
    .lte('date', '2026-05-05')
    .order('date')

  console.log('Transactions around the April-May boundary:')
  txs.forEach(t => {
    console.log(`  ${t.date} | ${t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)} | ${t.description}`)
  })
}

run().catch(console.error)
