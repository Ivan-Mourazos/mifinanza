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

  console.log(`Setting up 'Retenciones' pot for user: ${email} (${uid})`)

  // Check if Retenciones pot exists
  let { data: pots } = await supabase
    .from('saving_pots')
    .select('*')
    .eq('user_id', uid)

  let retencionesPot = pots?.find(p => p.name === 'Retenciones')

  if (!retencionesPot) {
    console.log("Creating 'Retenciones' pot...")
    const { data: newPot, error: createError } = await supabase
      .from('saving_pots')
      .insert({
        user_id: uid,
        name: 'Retenciones',
        target_amount: 0,
        color_code: '#FF0055'
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating pot:", createError)
      process.exit(1)
    }
    retencionesPot = newPot
    console.log("Created pot:", retencionesPot)
  } else {
    console.log("Pot 'Retenciones' already exists:", retencionesPot)
  }

  // Get current balance of Retenciones pot
  const { data: movements } = await supabase
    .from('saving_pot_movements')
    .select('*')
    .eq('user_id', uid)
    .eq('pot_id', retencionesPot.id)

  let currentBalance = 0
  movements?.forEach(m => {
    const amt = Number(m.amount)
    if (m.type === 'deposit') currentBalance += amt
    else currentBalance -= amt
  })

  console.log(`Current 'Retenciones' balance: ${currentBalance}`)

  const targetBalance = 35.76 // 5.99 + 29.77
  const diff = targetBalance - currentBalance

  if (Math.abs(diff) > 0.005) {
    console.log(`Adjusting balance by ${diff.toFixed(2)} to reach ${targetBalance}...`)
    const type = diff > 0 ? 'deposit' : 'withdrawal'
    const { error: moveError } = await supabase
      .from('saving_pot_movements')
      .insert({
        user_id: uid,
        pot_id: retencionesPot.id,
        amount: Math.abs(diff),
        type: type,
        note: 'Ajuste inicial de retenciones'
      })

    if (moveError) {
      console.error("Error inserting movement:", moveError)
      process.exit(1)
    }
    console.log("Balance successfully adjusted!")
  } else {
    console.log("Balance is already correct.")
  }
}

run().catch(console.error)
