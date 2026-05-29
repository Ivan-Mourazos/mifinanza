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

  // Find Retiro Efectivo category
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', uid)
    .eq('name', 'Retiro Efectivo')
    .eq('type', 'expense')

  if (!categories || categories.length === 0) {
    console.error("Retiro Efectivo category not found")
    process.exit(1)
  }

  const categoryId = categories[0].id
  console.log(`Found Retiro Efectivo category ID: ${categoryId}`)

  // Check if this adjustment transaction already exists
  const { data: existing } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .eq('date', '2026-05-01')
    .eq('amount', 40.00)
    .eq('type', 'expense')
    .eq('description', 'Retirada de efectivo (ajuste)')

  if (existing && existing.length > 0) {
    console.log("Adjustment transaction already exists.")
  } else {
    console.log("Inserting missing 40.00 withdrawal transaction...")
    const { data: newTx, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: uid,
        amount: 40.00,
        date: '2026-05-01',
        description: 'Retirada de efectivo (ajuste)',
        original_description: 'Retirada de efectivo (ajuste)',
        category_id: categoryId,
        type: 'expense'
      })
      .select()

    if (insertError) {
      console.error("Error inserting transaction:", insertError)
      process.exit(1)
    }
    console.log("Successfully inserted transaction:", newTx)
  }
}

run().catch(console.error)
