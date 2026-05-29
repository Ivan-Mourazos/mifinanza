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

// ─── Helpers ────────────────────────────────────────────────────────────────

function toTitleCase(str) {
  // Convert ALL-CAPS or mixed strings to "Title Case"
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-–/])\S/g, (c) => c.toUpperCase())
}

function cleanDescription(desc) {
  if (!desc) return desc

  // Remove location suffixes like " MELIDE ES", " MADRID ES", " SANTIAGO DE CES", etc.
  let cleaned = desc
    .replace(/\s+[A-Z\s]+\s+ES$/i, '')       // "CANTON S.C. MELIDE ES" → "CANTON S.C."
    .replace(/\s+ES$/i, '')                    // trailing " ES"
    .trim()

  // Convert to title case only if mostly uppercase (>60% uppercase letters)
  const letters = cleaned.replace(/[^a-zA-Z]/g, '')
  const upper = cleaned.replace(/[^A-Z]/g, '')
  if (letters.length > 0 && upper.length / letters.length > 0.6) {
    cleaned = toTitleCase(cleaned)
  }

  return cleaned.trim()
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  if (!user) { console.error("User not found"); process.exit(1) }
  const uid = user.id

  console.log(`User: ${email} (${uid})`)

  // ── 1. Fetch existing categories ──────────────────────────────────────────
  const { data: existingCats } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', uid)

  const catByName = {}
  existingCats.forEach(c => catByName[c.name] = c)
  console.log(`\nExisting categories: ${existingCats.map(c => c.name).join(', ')}`)

  // ── 2. Create missing categories ──────────────────────────────────────────
  const newCategories = [
    { name: 'Restaurantes / Bares', type: 'expense', color_code: '#FF6B35' },
    { name: 'Salud / Veterinario',  type: 'expense', color_code: '#FF4D6D' },
    { name: 'Hogar / Servicios',    type: 'expense', color_code: '#7B68EE' },
    { name: 'Herramientas / Software', type: 'expense', color_code: '#4ECDC4' },
    { name: 'Entretenimiento Digital', type: 'expense', color_code: '#A855F7' },
    { name: 'Transferencia Interna',   type: 'expense', color_code: '#94A3B8' },
    { name: 'Hotel / Alojamiento',     type: 'expense', color_code: '#F59E0B' },
    { name: 'Devoluciones',  type: 'income', color_code: '#10B981' },
    { name: 'Ingresos Varios', type: 'income', color_code: '#6366F1' },
  ]

  for (const cat of newCategories) {
    if (catByName[cat.name]) {
      console.log(`  Category already exists: ${cat.name}`)
      continue
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...cat, user_id: uid })
      .select()
      .single()
    if (error) {
      console.error(`  ERROR creating ${cat.name}:`, error.message)
    } else {
      catByName[cat.name] = data
      console.log(`  ✓ Created: ${cat.name} (${data.id})`)
    }
  }

  // Re-fetch to ensure all IDs are fresh
  const { data: allCats } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', uid)
  allCats.forEach(c => catByName[c.name] = c)

  const catId = (name) => {
    if (!catByName[name]) throw new Error(`Category not found: "${name}"`)
    return catByName[name].id
  }

  // ── 3. Fetch all transactions ─────────────────────────────────────────────
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', uid)

  console.log(`\nTotal transactions: ${txs.length}`)

  // ── 4. Build reclassification rules ──────────────────────────────────────
  // Rules: match on original_description (case-insensitive), set new category + new description
  const rules = [
    // ── Restaurantes / Bares ──
    { match: /BAR ATENAS/i,        cat: 'Restaurantes / Bares', desc: 'Bar Atenas' },
    { match: /CERVECRIA O TRASNO/i, cat: 'Restaurantes / Bares', desc: 'Cervecería O Trasno' },
    { match: /MESON VISANTO/i,     cat: 'Restaurantes / Bares', desc: 'Mesón Visantosa' },
    { match: /NOVO BANDUA/i,       cat: 'Restaurantes / Bares', desc: 'Novo Bandua' },
    { match: /PIZZERIA XOLDRA/i,   cat: 'Restaurantes / Bares', desc: 'Pizzería Xoldra' },
    { match: /CIRCUSWEETS/i,       cat: 'Restaurantes / Bares', desc: 'CircuSweets' },
    { match: /RUA 24 MELIDE/i,     cat: 'Restaurantes / Bares', desc: 'Rúa 24' },

    // ── Salud / Veterinario ──
    { match: /C\.VETERINARIA AGARIMOS/i, cat: 'Salud / Veterinario', desc: 'Clínica Veterinaria Agarimos' },

    // ── Ropa o Complementos ──
    { match: /PULL AND BEAR/i,     cat: 'Ropa o Complementos', desc: 'Pull&Bear' },
    { match: /LEFTIES/i,           cat: 'Ropa o Complementos', desc: 'Lefties' },
    { match: /^SPRINGFIELD/i,      cat: 'Ropa o Complementos', desc: 'Springfield' },
    { match: /^Springfield$/i,     cat: 'Ropa o Complementos', desc: 'Springfield' },
    { match: /PRIMARK/i,           cat: 'Ropa o Complementos', desc: 'Primark' },
    { match: /^ZARA$/i,            cat: 'Ropa o Complementos', desc: 'Zara' },

    // ── Gasolinera ──
    { match: /EESS LALIN PETROL/i, cat: 'Gasolinera', desc: 'E.S. Lalin Petrol' },

    // ── Hotel / Alojamiento ──
    { match: /HOTEL CARLOS 96/i,   cat: 'Hotel / Alojamiento', desc: 'Hotel Carlos 96' },

    // ── Herramientas / Software ──
    { match: /OPENAI \*CHATGPT/i,  cat: 'Herramientas / Software', desc: 'ChatGPT (OpenAI)' },
    { match: /CURSOR, AI/i,        cat: 'Herramientas / Software', desc: 'Cursor AI' },
    { match: /GOOGLE\*?CLOUD/i,    cat: 'Herramientas / Software', desc: 'Google Cloud' },
    { match: /ASPIEGEL/i,          cat: 'Herramientas / Software', desc: 'Huawei App Gallery' },

    // ── Entretenimiento Digital ──
    { match: /WWW\.DAZN\.COM/i,    cat: 'Entretenimiento Digital', desc: 'DAZN' },
    { match: /PAYPAL \*STEAM/i,    cat: 'Entretenimiento Digital', desc: 'Steam' },
    { match: /PAYPAL \*ITCH/i,     cat: 'Entretenimiento Digital', desc: 'Itch.io' },
    { match: /SUNO INC/i,          cat: 'Entretenimiento Digital', desc: 'Suno' },
    { match: /PAYPAL \*WAVESN/i,   cat: 'Suscripción Apps',        desc: 'Waves (Paypal)' },
    { match: /PAYPAL \*CLARITYCHEC/i, cat: 'Suscripción Apps',     desc: 'ClarityCheck (Paypal)' },

    // ── Suscripción Apps (keep / fix names) ──
    { match: /APPLE\.COM\/BILL/i,  cat: 'Suscripción Apps', desc: 'Apple (iCloud / App Store)' },
    { match: /GOOGLE ONE/i,        cat: 'Suscripción Apps', desc: 'Google One' },

    // ── Transferencia Interna ──
    { match: /IVAN SANCHEZ VAZQUEZ/i, cat: 'Transferencia Interna', desc: 'Cuenta compartida (Ivan)' },
    { match: /Cuota Ivan 2Izq/i,      cat: 'Transferencia Interna', desc: 'Cuota piso Ivan 2Izq' },
    { match: /PAGO GASOIL IVAN PORTAL/i, cat: 'Transferencia Interna', desc: 'Pago gasoil piso Ivan' },

    // ── Hogar / Servicios ──
    { match: /CUOTA MENSUAL DE FRACCIONAMIENTO/i, cat: 'Hogar / Servicios', desc: 'Cuota fraccionamiento de gastos' },
    { match: /^0182-4240-29-0830083178$/i,        cat: 'Hogar / Servicios', desc: 'Cuota fraccionamiento BBVA' },
    { match: /COMISIONES POR SERVICIOS/i,         cat: 'Hogar / Servicios', desc: 'Comisión bancaria' },
    { match: /DNI\/PASAPORTE/i,                   cat: 'Hogar / Servicios', desc: 'Renovación DNI/Pasaporte' },
    { match: /AB SERVICIOS SELECTA/i,             cat: 'Hogar / Servicios', desc: 'AB Servicios Selecta' },

    // ── Compra Online (Canton = 24h) ──
    { match: /CANTON S\.C\./i,     cat: 'Compra Online', desc: 'Cantón S.C. (24h)' },

    // ── Compras generales (fix descriptions) ──
    { match: /MIGUEL FLORISTAS/i,  cat: 'Compras', desc: 'Miguel Floristas' },
    { match: /FAMILIA MELIDE/i,    cat: 'Supermercado', desc: 'Familia Supermercado' },
    { match: /146\.GA\.MELIDE/i,   cat: 'Supermercado', desc: 'Supermercado Melide' },
    { match: /DOLAKA INTERNATIONAL/i, cat: 'Compra Online', desc: 'Dolaka International' },
    { match: /AMZN MKTP/i,         cat: 'Compra Online', desc: 'Amazon Marketplace' },
    { match: /aliexpress/i,        cat: 'Compra Online', desc: 'AliExpress' },
    { match: /ALIEXPRESS/i,        cat: 'Compra Online', desc: 'AliExpress' },
    { match: /REVOLUT\*\*6083\*/i, cat: 'Transferencia Interna', desc: 'Carga Revolut' },
    { match: /Revolut\*\*6083\*/i, cat: 'Transferencia Interna', desc: 'Carga Revolut' },
    { match: /VARIOS SERVICIO C\. LOTERIAS/i, cat: 'Compras', desc: 'Lotería (Tulotero)' },
    { match: /SP EGO GLOVES/i,     cat: 'Compra Online', desc: 'Sp Ego Gloves' },
    { match: /DECATHLON/i,         cat: 'Compra Online', desc: 'Decathlon' },

    // ── Ingresos ──
    { match: /ABONO POR FRACCIONAMIENTO/i,  cat: 'Ingresos Varios', desc: 'Abono fraccionamiento BBVA' },
    { match: /ABONO DEL INEM/i,             cat: 'Ingresos Varios', desc: 'Pago desempleo INEM' },
    { match: /BOLSA ASISTENZA/i,            cat: 'Transferencia', desc: 'Bolsa asistencia (PIE)' },
    { match: /Transferencia recibida - Bolsa asistenza/i, cat: 'Transferencia', desc: 'Bolsa asistencia PIE' },
    { match: /Transferencia recibida - Ivan/i, cat: 'Transferencia', desc: 'Transferencia recibida de Ivan' },

    // ── Description-only cleanups (no category change needed) ──
    { match: /REPSOL WAYLET/i,     desc: 'Repsol Waylet' },
    { match: /E\.S TEIRABOA/i,     desc: 'E.S. Teiraboa (Arzúa)' },
    { match: /GASOLINERA YETHI/i,  desc: 'Gasolinera Yethi' },
    { match: /ABONO DE NOMINA.*NOMINA TGM/i, desc: 'Nómina TGM' },
    { match: /ADEUDO DE VODAFONE/i, desc: (orig) => {
      const match = orig.match(/N (\d+)/)
      return match ? `Vodafone (${match[1]})` : 'Adeudo Vodafone'
    }},
    { match: /ADEUDO DE TELEFONICA/i, desc: (orig) => {
      const match = orig.match(/N (\d+)/)
      return match ? `Telefónica (${match[1]})` : 'Adeudo Telefónica'
    }},
    { match: /Adeudo de vodafone/i, desc: 'Adeudo Vodafone' },
    { match: /Adeudo de telefonica/i, desc: 'Adeudo Telefónica' },
    { match: /RET\. EFECTIVO/i,    desc: 'Retirada de efectivo' },
    { match: /Ret\. efectivo/i,    desc: 'Retirada de efectivo' },
    { match: /BIZUM - RECIBIDO: Gasolina/i, desc: 'Bizum recibido: gasolina' },
    { match: /BIZUM - RECIBIDO: Guapo/i,    desc: 'Bizum recibido: guapo' },
    { match: /BIZUM - RECIBIDO: Navajita/i, desc: 'Bizum recibido: navajita platea' },
    { match: /BIZUM - RECIBIDO: Sin concepto/i, desc: 'Bizum recibido: sin concepto' },
    { match: /BIZUM - RECIBIDO: chaqueta Paula/i, desc: 'Bizum recibido: chaqueta Paula' },
    { match: /BIZUM - RECIBIDO: chaqueta/i, desc: 'Bizum recibido: chaqueta' },
    { match: /Bizum - Recibido: bizum de alba/i, desc: 'Bizum recibido de Alba' },
    { match: /Bizum - Recibido: sin concepto/i, desc: 'Bizum recibido: sin concepto' },
    { match: /BIZUM - COMPRA: FUNDAS LEON/i, desc: 'Bizum enviado: fundas León' },
    { match: /BIZUM - ENVIADO: Sin concepto/i, desc: 'Bizum enviado: sin concepto' },
    { match: /Bizum - Enviado: bocata/i,       desc: 'Bizum enviado: bocata' },
    { match: /Bizum - Enviado: sin concepto/i, desc: 'Bizum enviado: sin concepto' },
    { match: /LA INTERNACIONAL LUGO/i,  desc: 'La Internacional (Lugo)' },
    { match: /WWW CINESA ES/i,          desc: 'Cinesa' },
    { match: /LIBRERIA COUSAS/i,        desc: 'Librería Cousas' },
    { match: /Libreria cousas/i,        desc: 'Librería Cousas' },
    { match: /Meson visanto/i,          desc: 'Mesón Visantosa' },
    { match: /Novo bandua/i,            desc: 'Novo Bandua' },
    { match: /Bar atenas/i,             desc: 'Bar Atenas' },
    { match: /Bizum enviado: sin concepto/i, desc: 'Bizum enviado: sin concepto' },
    { match: /Pizzeria xoldra/i,        desc: 'Pizzería Xoldra' },
    { match: /Transferencia realizada - Ivan sanchez/i, desc: 'Cuenta compartida (Ivan)' },
    { match: /Ab servicios selecta/i,   desc: 'AB Servicios Selecta' },
    { match: /AMAZON\*\s+\w+/i,        desc: (orig) => `Amazon (${orig.replace(/^AMAZON\*\s*/i, '').slice(0, 12)})` },
    { match: /WWW\.AMAZON\*/i,         desc: (orig) => `Amazon (${orig.replace(/^WWW\.AMAZON\*\s*/i, '').slice(0, 12)})` },
    { match: /Www\.amazon\*/i,         desc: (orig) => `Amazon (${orig.replace(/^Www\.amazon\*\s*/i, '').slice(0, 12)})` },
    { match: /COFIDIS AMAZON/i,        desc: 'Amazon (pago Cofidis)' },
    { match: /Cofidis amazon/i,        desc: 'Amazon (pago Cofidis)' },
    { match: /Www\.amazon\* na37238m4/i, desc: 'Amazon (na37238m4)' },
    { match: /GOOGLE\*CLOUD/i,         desc: 'Google Cloud' },
    { match: /Google CLOUD/i,          desc: 'Google Cloud' },
    { match: /OPENAI \*CHATGPT/i,      desc: 'ChatGPT (OpenAI)' },
    { match: /Openai \*chatgpt/i,      desc: 'ChatGPT (OpenAI)' },
    { match: /APPLE\.COM\/BILL/i,      desc: 'Apple (iCloud / App Store)' },
    { match: /Apple\.com\/bill/i,      desc: 'Apple (iCloud / App Store)' },
    { match: /Google One/i,            desc: 'Google One' },
    { match: /PAYPAL \*WAVESN/i,       desc: 'Waves (Paypal)' },
    { match: /Paypal \*wavesn/i,       desc: 'Waves (Paypal)' },
    { match: /SUNO INC/i,              desc: 'Suno' },
    { match: /Suno inc/i,              desc: 'Suno' },
    { match: /SPRINGFIELD SANTIAGO/i,  desc: 'Springfield' },
    { match: /Primark lugo/i,          desc: 'Primark' },
    { match: /Zara$/i,                 desc: 'Zara' },
    { match: /Decathlon espana/i,      desc: 'Decathlon' },
    { match: /Aliexpress/i,            desc: 'AliExpress' },
    { match: /Sp ego gloves/i,         desc: 'SP Ego Gloves' },
    { match: /Repsol waylet/i,         desc: 'Repsol Waylet' },
    { match: /Www\.amazon\* n66ba5jc4/i, desc: 'Amazon (n66ba5jc4)' },
    { match: /Www\.amazon\* na9x17p74/i, desc: 'Amazon (na9x17p74)' },
    { match: /Www\.amazon\* n62t384n4/i, desc: 'Amazon (n62t384n4)' },
    { match: /WWW\.AMAZON\*NB6NE29O4/i, desc: 'Amazon (NB6NE29O4)' },
    { match: /WWW\.AMAZON\.\*\s+\w+/i,  desc: (orig) => `Amazon (${orig.replace(/^WWW\.AMAZON\.\*\s*/i, '').slice(0, 12)})` },
    { match: /WWW\.AMAZON\* \w+/i,       desc: (orig) => `Amazon (${orig.replace(/^WWW\.AMAZON\*\s*/i, '').slice(0, 12)})` },
    { match: /AMAZON\* \w+/i,           desc: (orig) => `Amazon (${orig.replace(/^AMAZON\*\s*/i, '').slice(0, 12)})` },
  ]

  // ── 5. Apply rules & collect updates ─────────────────────────────────────
  let updated = 0
  let skipped = 0

  for (const tx of txs) {
    const orig = tx.original_description || tx.description
    let newCatId = tx.category_id
    let newDesc = tx.description

    for (const rule of rules) {
      if (rule.match.test(orig)) {
        if (rule.cat) {
          newCatId = catId(rule.cat)
        }
        if (rule.desc) {
          newDesc = typeof rule.desc === 'function' ? rule.desc(orig) : rule.desc
        }
        break // first matching rule wins
      }
    }

    // Check if anything changed
    if (newCatId === tx.category_id && newDesc === tx.description) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('transactions')
      .update({ category_id: newCatId, description: newDesc })
      .eq('id', tx.id)

    if (error) {
      console.error(`  ERROR updating ${tx.id} (${orig}):`, error.message)
    } else {
      updated++
      const catOld = allCats.find(c => c.id === tx.category_id)?.name || '?'
      const catNew = allCats.find(c => c.id === newCatId)?.name || catByName[Object.keys(catByName).find(k => catByName[k].id === newCatId)]?.name || '?'
      if (tx.category_id !== newCatId) {
        console.log(`  ✓ [${tx.date}] ${catOld} → ${catNew} | "${newDesc}"`)
      } else {
        console.log(`  ✓ [${tx.date}] desc fix: "${tx.description}" → "${newDesc}"`)
      }
    }
  }

  console.log(`\n✓ Updated: ${updated} | Skipped (no change): ${skipped}`)

  // ── 6. Set initial balance to 29.20€ ─────────────────────────────────────
  console.log('\n── Setting initial balance to 29.20€ ──')

  const { data: existingSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', uid)

  if (existingSettings && existingSettings.length > 0) {
    const { error } = await supabase
      .from('user_settings')
      .update({ initial_balance: 29.20, updated_at: new Date().toISOString() })
      .eq('user_id', uid)
    if (error) console.error('ERROR updating settings:', error.message)
    else console.log('✓ Initial balance updated to 29.20€')
  } else {
    const { error } = await supabase
      .from('user_settings')
      .insert({ user_id: uid, initial_balance: 29.20, currency: 'EUR' })
    if (error) console.error('ERROR inserting settings:', error.message)
    else console.log('✓ Initial balance set to 29.20€')
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  const { data: finalCats } = await supabase
    .from('categories')
    .select('name, type')
    .eq('user_id', uid)
    .order('type')
    .order('name')

  console.log('\n=== FINAL CATEGORIES ===')
  finalCats.forEach(c => console.log(`  [${c.type}] ${c.name}`))
}

run().catch(e => { console.error(e); process.exit(1) })
