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

  console.log(`Setting up Retenciones as normal expenses for user: ${email} (${uid})`)

  // 1. Delete Retenciones pot and its movements if they exist
  const { data: pots } = await supabase.from('saving_pots').select('id').eq('user_id', uid).eq('name', 'Retenciones')
  if (pots && pots.length > 0) {
    for (const pot of pots) {
      console.log(`Deleting pot movements for pot ID: ${pot.id}`)
      await supabase.from('saving_pot_movements').delete().eq('pot_id', pot.id)
      console.log(`Deleting pot ID: ${pot.id}`)
      await supabase.from('saving_pots').delete().eq('id', pot.id)
    }
  }

  // 2. Ensure "Retenciones" category exists
  let { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', uid)
    .eq('name', 'Retenciones')
    .eq('type', 'expense')

  let retencionesCat = categories?.[0]

  if (!retencionesCat) {
    console.log("Creating 'Retenciones' category...")
    const { data: newCat, error: createError } = await supabase
      .from('categories')
      .insert({
        user_id: uid,
        name: 'Retenciones',
        type: 'expense',
        color_code: '#FF0055'
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating category:", createError)
      process.exit(1)
    }
    retencionesCat = newCat
    console.log("Created category:", retencionesCat)
  } else {
    console.log("Category 'Retenciones' already exists:", retencionesCat)
  }

  // 3. Insert the two hold transactions if they don't exist
  const holdsToInsert = [
    { amount: 5.99, desc: 'RETENCION COMPRAS A DISTANCIA' },
    { amount: 29.77, desc: 'RETENCION SERVICIOS VARIOS' }
  ]

  for (const hold of holdsToInsert) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .eq('amount', hold.amount)
      .eq('description', hold.desc)
      .eq('category_id', retencionesCat.id)

    if (existing && existing.length > 0) {
      console.log(`Hold transaction already exists: ${hold.desc}`)
    } else {
      console.log(`Inserting hold transaction: ${hold.desc} (${hold.amount})`)
      const { data: newTx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          user_id: uid,
          amount: hold.amount,
          date: '2026-05-28',
          description: hold.desc,
          original_description: hold.desc,
          category_id: retencionesCat.id,
          type: 'expense'
        })
        .select()

      if (txErr) {
        console.error("Error inserting transaction:", txErr)
        process.exit(1)
      }
      console.log("Inserted transaction:", newTx)
    }
  }

  // 4. Verify balances
  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', uid).single()
  const initialBalance = settings?.initial_balance || 0

  const { data: txs } = await supabase.from('transactions').select('amount, type, category_id').eq('user_id', uid)
  let txBalance = 0
  let holdsBalance = 0

  txs.forEach(t => {
    const val = Number(t.amount)
    const isHold = t.category_id === retencionesCat.id
    if (t.type === 'income') {
      txBalance += val
    } else {
      txBalance -= val
      if (isHold) {
        holdsBalance += val
      }
    }
  })

  // Pots
  const { data: regularPots } = await supabase.from('saving_pots').select('*').eq('user_id', uid).neq('name', 'Retenciones')
  const { data: potMoves } = await supabase.from('saving_pot_movements').select('amount, type, pot_id').eq('user_id', uid)
  
  const potBalances = {}
  regularPots.forEach(p => potBalances[p.id] = 0)
  potMoves.forEach(m => {
    if (potBalances[m.pot_id] !== undefined) {
      const val = Number(m.amount)
      if (m.type === 'deposit') potBalances[m.pot_id] += val
      else potBalances[m.pot_id] -= val
    }
  })
  const totalPotsBalance = Object.values(potBalances).reduce((a, b) => a + b, 0)

  const accountBalance = initialBalance + txBalance
  const availableBalance = accountBalance - totalPotsBalance
  const totalWorth = availableBalance + totalPotsBalance + holdsBalance

  console.log('\n--- VERIFICATION MATH ---')
  console.log(`Initial Balance (Jan 1st): ${initialBalance}`)
  console.log(`All transactions sum (including holds): ${txBalance}`)
  console.log(`Account Balance (initial + txs): ${accountBalance}`)
  console.log(`Saving Pots Balance: ${totalPotsBalance}`)
  console.log(`Holds Balance (Retenciones category): ${holdsBalance}`)
  console.log(`Available Balance (Account - Pots): ${availableBalance}`)
  console.log(`Total Worth (Available + Pots + Holds): ${totalWorth}`)
}

run().catch(console.error)
