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

  // Fix the Amazon return on 2026-05-26
  // original_description = "Www.amazon* na37238m4", description should be "Devolución pantalón fútbol Amazon"
  // The description was manually edited before but got overwritten by our rule
  // Let's restore it with a proper description and put it in Devoluciones category

  const { data: cats } = await supabase.from('categories').select('id,name').eq('user_id', uid)
  const catMap = {}
  cats.forEach(c => catMap[c.name] = c.id)

  // Fix amazon return
  const { data: amazonReturn } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .eq('date', '2026-05-26')
    .eq('type', 'income')

  console.log("Found May 26 income txs:", amazonReturn)

  for (const tx of amazonReturn) {
    if (tx.original_description?.includes('amazon') || tx.original_description?.includes('Amazon')) {
      const { error } = await supabase
        .from('transactions')
        .update({
          description: 'Devolución pantalón fútbol (Amazon)',
          category_id: catMap['Devoluciones']
        })
        .eq('id', tx.id)
      if (error) console.error('ERROR:', error.message)
      else console.log(`✓ Fixed amazon return: "${tx.description}" → "Devolución pantalón fútbol (Amazon)" → Devoluciones`)
    }
  }

  // Also fix descriptions that might have "Amazon (WWW.AMAZON* )" 
  const { data: badDescs } = await supabase
    .from('transactions')
    .select('id, date, description, original_description')
    .eq('user_id', uid)
    .like('description', 'Amazon (WWW%')

  console.log("\nBad Amazon descriptions:", badDescs?.length)
  for (const tx of badDescs || []) {
    // Extract the code from original_description
    const orig = tx.original_description || ''
    const code = orig.replace(/^(WWW\.AMAZON\*|Www\.amazon\*|AMAZON\*)\s*/i, '').slice(0, 12).trim()
    const newDesc = code ? `Amazon (${code})` : 'Amazon'
    const { error } = await supabase
      .from('transactions')
      .update({ description: newDesc })
      .eq('id', tx.id)
    if (error) console.error('ERROR:', error.message)
    else console.log(`✓ Fixed: "${tx.description}" → "${newDesc}"`)
  }

  // Springfield (income) was marked as Salario — if it was actually a return, check
  const { data: springReturn } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .eq('original_description', 'Springfield')
    .eq('type', 'income')

  console.log("\nSpringfield income txs:", springReturn)
  for (const tx of springReturn) {
    const { error } = await supabase
      .from('transactions')
      .update({
        description: 'Devolución Springfield',
        category_id: catMap['Devoluciones']
      })
      .eq('id', tx.id)
    if (error) console.error('ERROR:', error.message)
    else console.log(`✓ Fixed Springfield return → Devoluciones`)
  }

  // Fix IVAN income tx — this was "Ivan Sanchez Vazquez" as income (a return from shared account?)
  const { data: ivanIncome } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .like('original_description', '%Ivan Sanchez Vazquez%')
    .eq('type', 'income')
  
  console.log("\nIvan income txs:", ivanIncome)
  // These stay in Salario/Transferencia — they are incoming transfers

  // Final check on all Salario to see if anything unexpected remains
  const salarioCat = cats.find(c => c.name === 'Salario')
  const { data: salarioTxs } = await supabase
    .from('transactions')
    .select('date, amount, description, original_description')
    .eq('user_id', uid)
    .eq('category_id', salarioCat.id)
    .order('date')

  console.log("\n=== SALARIO (final) ===")
  salarioTxs.forEach(t => console.log(`  ${t.date} | +${t.amount} | "${t.description}" | orig: "${t.original_description}"`))

  // Check all categories final counts
  const { data: allTxs } = await supabase
    .from('transactions')
    .select('category_id')
    .eq('user_id', uid)

  const countByCat = {}
  allTxs.forEach(t => countByCat[t.category_id] = (countByCat[t.category_id] || 0) + 1)

  console.log("\n=== TRANSACTION COUNT BY CATEGORY ===")
  cats.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
    const count = countByCat[c.id] || 0
    if (count > 0) console.log(`  ${c.name}: ${count}`)
  })
}

run().catch(e => { console.error(e); process.exit(1) })
