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
  
  // Sum of all transactions (since the beginning)
  const { data: txs } = await supabase.from('transactions').select('amount, type').eq('user_id', uid)
  let txBalance = 0
  txs.forEach(t => {
    const val = Number(t.amount)
    if (t.type === 'income') txBalance += val
    else txBalance -= val
  })

  // Pots balance
  const { data: pots, error: potsErr } = await supabase.from('saving_pots').select('*').eq('user_id', uid)
  if (potsErr) console.error('Pots error:', potsErr)
  // Let's get pot movements to calculate balance
  const { data: potMoves, error: movesErr } = await supabase.from('saving_pot_movements').select('amount, type, pot_id').eq('user_id', uid)
  if (movesErr) console.error('Movements error:', movesErr)
  const potBalances = {}
  if (pots) {
    pots.forEach(p => potBalances[p.id] = 0)
  }
  if (potMoves) {
    potMoves.forEach(m => {
      const val = Number(m.amount)
      if (m.type === 'add') potBalances[m.pot_id] = (potBalances[m.pot_id] || 0) + val
      else potBalances[m.pot_id] = (potBalances[m.pot_id] || 0) - val
    })
  }
  const totalPotsBalance = Object.values(potBalances).reduce((a, b) => a + b, 0)

  console.log('Settings:', settings)
  console.log('Transaction balance (all time):', txBalance)
  console.log('Total Pots Balance:', totalPotsBalance)
  console.log('Calculated Account Balance (initial_balance + txBalance):', ((settings ? settings.initial_balance : 0) || 0) + txBalance)
  console.log('Calculated Available Balance (Account Balance - Total Pots):', ((settings ? settings.initial_balance : 0) || 0) + txBalance - totalPotsBalance)
}

run().catch(console.error)
