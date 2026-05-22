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

async function findUserByEmail(supabase, email) {
  const perPage = 100
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) throw error

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    )

    if (user) return user
    if (data.users.length < perPage) return null

    page += 1
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.MIFINANZA_ADMIN_EMAIL
const password = process.env.MIFINANZA_ADMIN_PASSWORD

const missingKeys = [
  ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
  ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
  ['MIFINANZA_ADMIN_EMAIL', email],
  ['MIFINANZA_ADMIN_PASSWORD', password],
]
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingKeys.length > 0) {
  console.error(`Faltan variables en .env.local:\n${missingKeys.map((key) => `- ${key}`).join('\n')}`)
  process.exit(1)
}

if (password.length < 6) {
  console.error('MIFINANZA_ADMIN_PASSWORD debe tener al menos 6 caracteres.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

try {
  const existingUser = await findUserByEmail(supabase, email)

  if (existingUser) {
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      email_confirm: true,
    })

    if (error) throw error

    console.log(`Usuario actualizado y confirmado: ${email}`)
    process.exit(0)
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw error

  console.log(`Usuario creado y confirmado: ${email}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo crear el usuario.')
  process.exit(1)
}
