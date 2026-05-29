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
    .select('date, amount, type')
    .eq('user_id', uid)

  const months = {}
  for (const t of txs) {
    const m = t.date.slice(0, 7)
    if (!months[m]) {
      months[m] = { income: 0, expense: 0, count: 0 }
    }
    const val = Number(t.amount)
    if (t.type === 'income') {
      months[m].income += val
    } else {
      months[m].expense += val
    }
    months[m].count++
  }

  console.log('Transactions grouped by month:')
  Object.keys(months).sort().forEach(m => {
    console.log(`${m}: count=${months[m].count}, income=+${months[m].income.toFixed(2)}, expense=-${months[m].expense.toFixed(2)}`)
  })
}

run().catch(console.error)
