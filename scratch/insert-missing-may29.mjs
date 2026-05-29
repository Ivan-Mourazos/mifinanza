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

  const { data: cats } = await supabase.from('categories').select('id, name').eq('user_id', uid)
  
  const getCatId = (name) => {
    const found = cats.find(c => c.name.toLowerCase().includes(name.toLowerCase()))
    return found ? found.id : null
  }

  const appStoreCat = getCatId('Suscripción Apps')
  const transferCat = getCatId('Transferencia Interna')
  const superCat = getCatId('Supermercado')

  console.log('Found categories:')
  console.log(`  Suscripción Apps: ${appStoreCat}`)
  console.log(`  Transferencia Interna: ${transferCat}`)
  console.log(`  Supermercado: ${superCat}`)

  const newTxs = [
    {
      user_id: uid,
      date: '2026-05-29',
      amount: 0.99,
      type: 'expense',
      description: 'Apple (iCloud / App Store)',
      original_description: 'Apple.com/bill',
      category_id: appStoreCat
    },
    {
      user_id: uid,
      date: '2026-05-29',
      amount: 10.00,
      type: 'expense',
      description: 'Carga Revolut',
      original_description: 'Revolut**6083*',
      category_id: transferCat
    },
    {
      user_id: uid,
      date: '2026-05-29',
      amount: 16.54,
      type: 'expense',
      description: 'Supermercado Melide',
      original_description: '146.ga.melide 2 melide ...',
      category_id: superCat
    }
  ]

  // Verify they don't exist yet to prevent duplicate run errors
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, date, amount, description')
    .eq('user_id', uid)
    .eq('date', '2026-05-29')
    .eq('type', 'expense')

  const toInsert = newTxs.filter(nt => {
    return !existing.some(ex => 
      ex.date === nt.date && 
      Math.abs(Number(ex.amount) - nt.amount) < 0.01 &&
      ex.description === nt.description
    )
  })

  if (toInsert.length === 0) {
    console.log('All transactions already exist in the database.')
    return
  }

  console.log(`Inserting ${toInsert.length} new transactions...`)
  const { error } = await supabase.from('transactions').insert(toInsert)
  if (error) {
    console.error('Error inserting transactions:', error)
  } else {
    console.log('Successfully inserted transactions!')
    toInsert.forEach(t => console.log(`  Inserted: ${t.date} | -${t.amount} | ${t.description}`))
  }
}

run().catch(console.error)
