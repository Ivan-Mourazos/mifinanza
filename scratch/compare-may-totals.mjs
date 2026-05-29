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
    .order('date')

  const { data: cats } = await supabase.from('categories').select('id,name').eq('user_id', uid)
  const catMap = {}
  cats.forEach(c => catMap[c.id] = c.name)

  let totalIncome = 0, totalExpense = 0
  console.log(`\n=== Mayo 2026 — ${txs.length} transacciones ===\n`)
  console.log(`${'FECHA'.padEnd(12)} ${'TIPO'.padEnd(8)} ${'IMPORTE'.padStart(10)}  CATEGORÍA / DESCRIPCIÓN`)
  console.log('─'.repeat(70))
  for (const t of txs) {
    const sign = t.type === 'income' ? '+' : '-'
    const amt = Number(t.amount)
    if (t.type === 'income') totalIncome += amt
    else totalExpense += amt
    console.log(
      `${t.date.padEnd(12)} ${t.type.padEnd(8)} ${(sign + amt.toFixed(2)).padStart(10)}  [${catMap[t.category_id] || '?'}] ${t.description}`
    )
  }
  console.log('─'.repeat(70))
  console.log(`INGRESOS:  +${totalIncome.toFixed(2)}`)
  console.log(`GASTOS:    -${totalExpense.toFixed(2)}`)
  console.log(`BALANCE:    ${(totalIncome - totalExpense).toFixed(2)}`)
  console.log(`\nBanco dice: ingresos 1369.28 | gastos 1030.68`)
  console.log(`Diferencia ingresos: ${(totalIncome - 1369.28).toFixed(2)}`)
  console.log(`Diferencia gastos:   ${(totalExpense - 1030.68).toFixed(2)}`)
}

run().catch(e => { console.error(e); process.exit(1) })
