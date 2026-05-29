import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
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

  const { data: dbTxs } = await supabase
    .from('transactions')
    .select('date, amount, type, description')
    .eq('user_id', uid)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-28')
    .order('date', { ascending: true })

  // Read Excel
  const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const excelTxs = []
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 7) continue
    const dateStr = row[1]
    const concept = row[2] || ''
    const amount = Number(row[4])
    const balance = Number(row[6])
    
    const parts = dateStr.split('/')
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
    excelTxs.push({
      date: formattedDate,
      concept,
      amount,
      balance
    })
  }

  // Reverse Excel transactions so they are chronological (from May 4 to May 28)
  excelTxs.reverse()

  console.log('CHRONOLOGICAL EXCEL:')
  excelTxs.forEach((ex, idx) => {
    console.log(`[E-${idx}] ${ex.date} | ${ex.amount > 0 ? '+' : ''}${ex.amount.toFixed(2).padStart(8)} | Bal: ${ex.balance.toFixed(2).padStart(8)} | ${ex.concept}`)
  })

  console.log('\nCHRONOLOGICAL DB (May 1 to May 28):')
  // We need to know what the running balance was before May 1st.
  const { data: preTxs } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', uid)
    .lt('date', '2026-05-01')

  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', uid).single()
  let running = settings?.initial_balance || 0
  preTxs.forEach(t => {
    const amt = Number(t.amount)
    if (t.type === 'income') running += amt
    else running -= amt
  })

  console.log(`Running balance before May 1st: ${running}`)

  dbTxs.forEach((db, idx) => {
    const amt = Number(db.amount)
    if (db.type === 'income') running += amt
    else running -= amt
    console.log(`[D-${idx}] ${db.date} | ${db.type === 'income' ? '+' : '-'}${amt.toFixed(2).padStart(8)} | Bal: ${running.toFixed(2).padStart(8)} | ${db.description}`)
  })
}

run().catch(console.error)
