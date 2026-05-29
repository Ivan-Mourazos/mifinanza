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

  // 1. List existing pot movements
  const { data: movements } = await supabase
    .from('saving_pot_movements')
    .select('*')
    .eq('user_id', uid)

  console.log(`Current pot movements: ${movements?.length ?? 0}`)
  movements?.forEach(m => {
    console.log(`  [${m.type}] ${m.amount} | note: "${m.note}" | created: ${m.created_at}`)
  })

  // 2. Delete all of them to reset balance to 0
  if (movements && movements.length > 0) {
    const { error } = await supabase
      .from('saving_pot_movements')
      .delete()
      .eq('user_id', uid)

    if (error) {
      console.error('ERROR deleting movements:', error.message)
    } else {
      console.log(`\n✓ Deleted ${movements.length} pot movements — balance reset to 0`)
    }
  } else {
    console.log('No movements to delete.')
  }

  // 3. Verify
  const { data: after } = await supabase
    .from('saving_pot_movements')
    .select('*')
    .eq('user_id', uid)

  console.log(`\nPot movements after reset: ${after?.length ?? 0}`)
}

run().catch(e => { console.error(e); process.exit(1) })
