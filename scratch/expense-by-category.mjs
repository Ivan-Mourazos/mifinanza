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
    .select('date, amount, type, category_id')
    .eq('user_id', uid)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')

  const { data: cats } = await supabase.from('categories').select('id, name').eq('user_id', uid)
  const catMap = {}
  cats.forEach(c => catMap[c.id] = c.name)

  const catExpenses = {}
  let totalExpense = 0
  for (const t of txs) {
    if (t.type === 'expense') {
      const catName = catMap[t.category_id] || 'Sin categoría'
      catExpenses[catName] = (catExpenses[catName] || 0) + Number(t.amount)
      totalExpense += Number(t.amount)
    }
  }

  console.log('Expenses by category in May 2026:')
  Object.keys(catExpenses).sort().forEach(cat => {
    console.log(`  ${cat}: -${catExpenses[cat].toFixed(2)}`)
  })
  console.log(`\nTotal DB Expenses: -${totalExpense.toFixed(2)}`)
  console.log(`Bank App Expenses: -1030.68`)
  console.log(`Difference: ${totalExpense - 1030.68}`)
}

run().catch(console.error)
