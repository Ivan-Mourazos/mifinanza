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
  if (!user) { console.error("User not found"); process.exit(1) }

  // Dump categories
  const { data: cats } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('type')
    .order('name')

  console.log("\n=== CATEGORIES ===")
  cats.forEach(c => console.log(`[${c.type.toUpperCase()}] ${c.name} (${c.id})`))

  // Dump ALL transactions sorted by date
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, date, amount, type, description, original_description, category_id')
    .eq('user_id', user.id)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  // Build a map of category id -> name
  const catMap = {}
  cats.forEach(c => catMap[c.id] = `${c.name} (${c.type})`)

  console.log("\n=== ALL TRANSACTIONS (sorted by date) ===")
  txs.forEach(t => {
    const cat = catMap[t.category_id] || 'UNKNOWN'
    console.log(`${t.date} | ${t.type === 'expense' ? '-' : '+'}${t.amount} | ${cat} | desc: "${t.description}" | orig: "${t.original_description}"`)
  })

  // Group descriptions by category
  console.log("\n=== DESCRIPTIONS GROUPED BY CATEGORY ===")
  const byCat = {}
  txs.forEach(t => {
    const key = catMap[t.category_id] || 'UNKNOWN'
    if (!byCat[key]) byCat[key] = new Set()
    byCat[key].add(t.original_description || t.description)
  })
  Object.entries(byCat).sort().forEach(([cat, descs]) => {
    console.log(`\n[${cat}]`)
    ;[...descs].sort().forEach(d => console.log(`  - ${d}`))
  })
}

run()
