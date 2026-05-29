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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)

  // January transactions
  const { data: janTxs } = await supabase
    .from('transactions')
    .select('id, date, amount, type, description, original_description, category_id')
    .eq('user_id', user.id)
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-05')
    .order('date')
    .order('created_at')

  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('user_id', user.id)
  const catMap = {}
  cats.forEach(c => catMap[c.id] = `${c.name}`)

  console.log("=== January 1-5 transactions ===")
  janTxs.forEach(t => {
    console.log(`  ${t.date} | ${t.type === 'expense' ? '-' : '+'}${t.amount} | ${catMap[t.category_id]} | "${t.description}" | orig: "${t.original_description}"`)
  })

  // Find all transactions currently with "Compras" category that look mis-categorized
  const comprasCat = cats.find(c => c.name === 'Compras')
  const { data: comprasTxs } = await supabase
    .from('transactions')
    .select('id, date, amount, description, original_description')
    .eq('user_id', user.id)
    .eq('category_id', comprasCat.id)
    .order('date')

  console.log("\n=== All 'Compras' transactions ===")
  comprasTxs.forEach(t => {
    console.log(`  ${t.date} | -${t.amount} | "${t.description}" | orig: "${t.original_description}"`)
  })

  // Check current settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
  console.log("\n=== User Settings ===")
  console.log(settings)
}

run()
