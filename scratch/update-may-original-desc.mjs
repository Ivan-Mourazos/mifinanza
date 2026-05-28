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

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    console.error("Error:", error)
    process.exit(1)
  }

  const targets = txs.filter(t => !t.original_description)
  console.log(`Found ${targets.length} transactions with missing original_description.`)

  let updatedCount = 0
  for (const t of targets) {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ original_description: t.description })
      .eq('id', t.id)
    
    if (updateError) {
      console.error(`Error updating transaction ${t.id}:`, updateError)
    } else {
      updatedCount++
    }
  }

  console.log(`Successfully updated ${updatedCount} transactions!`)
}

run()
