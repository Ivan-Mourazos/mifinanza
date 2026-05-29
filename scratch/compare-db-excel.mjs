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

  // Load DB txs
  const { data: dbTxs } = await supabase
    .from('transactions')
    .select('id, date, amount, type, description, original_description')
    .eq('user_id', uid)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')

  // Load Excel txs
  const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const excelTxs = []
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 5) continue
    const dateStr = row[1]
    const concept = row[2] || ''
    const movement = row[3] || ''
    const amount = Math.abs(Number(row[4]))
    const type = Number(row[4]) > 0 ? 'income' : 'expense'
    
    const parts = dateStr.split('/')
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
    
    excelTxs.push({
      date: formattedDate,
      concept,
      movement,
      amount,
      type
    })
  }

  // Find DB transactions not in Excel
  console.log('=== DB TRANSACTIONS NOT IN EXCEL ===')
  let dbOnlyCount = 0
  for (const db of dbTxs) {
    // Try to find matching excel tx
    const matchIdx = excelTxs.findIndex(ex => 
      ex.date === db.date && 
      Math.abs(ex.amount - Number(db.amount)) < 0.01 && 
      ex.type === db.type
    )
    if (matchIdx === -1) {
      console.log(`  DB Only: ${db.date} | ${db.type === 'income' ? '+' : '-'}${db.amount} | "${db.description}" (orig: "${db.original_description}")`)
      dbOnlyCount++
    } else {
      excelTxs.splice(matchIdx, 1) // remove to handle duplicates correctly
    }
  }
  if (dbOnlyCount === 0) console.log('  None')

  console.log('\n=== EXCEL TRANSACTIONS NOT IN DB ===')
  if (excelTxs.length === 0) {
    console.log('  None')
  } else {
    excelTxs.forEach(ex => {
      console.log(`  Excel Only: ${ex.date} | ${ex.type === 'income' ? '+' : '-'}${ex.amount} | "${ex.concept}" (movement: "${ex.movement}")`)
    })
  }
}

run().catch(console.error)
