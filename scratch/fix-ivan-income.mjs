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
  const uid = user.id

  const { data: cats } = await supabase.from('categories').select('id,name').eq('user_id', uid)
  const catMap = {}
  cats.forEach(c => catMap[c.name] = c.id)

  // Fix IVAN 75€/month: category = Transferencia (income), description = "Reembolso internet (Padre)"
  const { error } = await supabase
    .from('transactions')
    .update({
      description: 'Reembolso internet (Padre)',
      category_id: catMap['Transferencia']
    })
    .eq('user_id', uid)
    .eq('original_description', 'IVAN')
    .eq('type', 'income')

  if (error) console.error('ERROR:', error.message)
  else console.log('✓ Fixed IVAN 75€ → Transferencia | "Reembolso internet (Padre)"')

  // Also check the Ivan Sanchez Vazquez income (25€ march) - that was from shared account, keep as Transferencia Interna
  // (already done in fix-remaining.mjs)

  // Also fix "Transferencia recibida - Ivan" in May
  const { data: ivanMay } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .eq('original_description', 'Transferencia recibida - Ivan')

  console.log("Ivan May tx:", ivanMay)
  for (const tx of ivanMay || []) {
    const { error } = await supabase
      .from('transactions')
      .update({
        description: 'Transferencia recibida (Ivan)',
        category_id: catMap['Transferencia']
      })
      .eq('id', tx.id)
    if (error) console.error('ERROR:', error.message)
    else console.log(`✓ Fixed "Transferencia recibida - Ivan" → Transferencia`)
  }

  console.log('\n✅ All fixes applied.')
}

run().catch(e => { console.error(e); process.exit(1) })
