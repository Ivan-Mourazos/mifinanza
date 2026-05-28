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

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  
  if (!user) {
    console.error("User not found")
    process.exit(1)
  }

  const { data: pots, error } = await supabase
    .from('saving_pots')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    console.error("Error:", error)
    process.exit(1)
  }

  console.log(`Current pots in DB: ${pots.length}`)

  if (pots.length > 1) {
    // Keep the first one, delete the rest
    const keepId = pots[0].id
    const toDelete = pots.slice(1)
    
    for (const p of toDelete) {
      const { error: deleteError } = await supabase
        .from('saving_pots')
        .delete()
        .eq('id', p.id)
      
      if (deleteError) {
        console.error(`Error deleting pot ${p.id}:`, deleteError)
      } else {
        console.log(`Deleted duplicate pot: ${p.id} (${p.name})`)
      }
    }
  }
}

run()
