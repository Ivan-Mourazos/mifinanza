const fs = require('node:fs')
const { PDFParse } = require('pdf-parse')
const { createClient } = require('@supabase/supabase-js')
const { resolve } = require('node:path')

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return

  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing supabase URL or service role key in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const MONTH_MAP = {
  'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
  'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function transactionDuplicateKey(t) {
  return [
    t.date,
    Number(t.amount).toFixed(2),
    t.type,
    normalizeText(t.original_description || t.description || ''),
  ].join('|')
}

function cleanDetails(details) {
  let clean = details.trim()
  // Remove 16-digit card number prefix
  clean = clean.replace(/^\d{16}\s+/, '')
  return clean
}

function guessCategoryName(description, type) {
  const desc = normalizeText(description)

  if (type === 'income') {
    if (desc.includes('bizum') || desc.includes('recibido:')) return 'Bizum'
    if (desc.includes('nomina') || desc.includes('salario') || desc.includes('pension')) return 'Salario'
    if (desc.includes('transferencia') || desc.includes('pablo') || desc.includes('recibida') || desc.includes('bolsa asistenza')) return 'Transferencia'
    return 'Otros ingresos'
  }

  // Gastos
  if (desc.includes('bizum') || desc.includes('enviado:')) return 'Bizum enviado'
  if (desc.includes('ret. efectivo') || desc.includes('cajero') || desc.includes('retiro')) return 'Retiro Efectivo'
  if (desc.includes('transferencia realizada') || desc.includes('traspaso') || desc.includes('adeudo traspaso') || desc.includes('conjunta')) return 'Transpasos'
  
  if (/(mercadona|carrefour|lidl|alcampo|dia |ahorramas|consum|eroski|aldi|hipercor|gadis|146\.ga|familia melide)/.test(desc)) return 'Supermercado'
  
  if (/(pizzeria|bar |restaurante|novo bandua|selecta|bocata|telepizza|mcdonald|burger|glovo|just eat|uber eats|vips|xoldra|pizza|meson|atenas|internacional)/.test(desc)) {
    return 'Restaurantes / Bares'
  }
  
  if (/(repsol|waylet|cepsa|galp|shell|bp|gasolinera|teiraboa)/.test(desc)) return 'Gasolinera'
  
  if (/(zara|primark|ropa|complemento|calzado|moda)/.test(desc)) return 'Ropa o Complementos'
  
  if (/(decathlon|amazon|cofidis|aliexpress)/.test(desc)) {
    return desc.includes('amazon') ? 'Compra Online' : 'Compras'
  }
  
  if (/(apple.com|suno|netflix|spotify|hbo|disney|youtube|steam|paypal|gemini|google one|apple music|chatgpt|openai|google cloud)/.test(desc)) {
    return 'Suscripción Apps'
  }
  
  if (/(telefonica|movistar|vodafone|orange|digi|iberdrola|endesa|naturgy|recibo|adeudo)/.test(desc)) {
    if (desc.includes('telefonica') || desc.includes('movistar') || desc.includes('vodafone') || desc.includes('orange') || desc.includes('digi')) {
      return 'Telefonía / Internet'
    }
    return 'Compras'
  }
  
  if (/(farmacia|medico|clinica|dentista|salud)/.test(desc)) return 'Compras'
  if (/(cine|teatro|concierto|entrada|libreria|cousas|ocio)/.test(desc)) return 'Ocio'
  
  return 'Compras'
}

const pdfFiles = [
  '16f84114-da20-4298-a5ae-ea07b53118a2.pdf',
  '65bc51af-69ca-40b1-9fb1-54c3e6f522e2.pdf',
  '729e91e7-27fe-493b-9bb5-a7b25d683ffa.pdf',
  '7fd10182-6b0f-41a7-8b4b-46dddf61089f.pdf'
]

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  
  if (!user) {
    console.error("User not found")
    process.exit(1)
  }
  console.log(`User found: ${user.id} (${email})`)

  // Load user categories from DB
  const { data: dbCategories } = await supabase.from('categories').select('*').eq('user_id', user.id)
  const categoryByNameAndType = new Map()
  dbCategories.forEach(cat => {
    categoryByNameAndType.set(`${cat.name.toLowerCase()}|${cat.type}`, cat.id)
  })

  // Load existing transactions
  const { data: existingTransactions } = await supabase.from('transactions').select('*').eq('user_id', user.id)
  const existingKeys = new Set(existingTransactions.map(t => transactionDuplicateKey(t)))
  console.log(`Loaded ${existingTransactions.length} existing transactions from DB.`)

  const toInsert = []
  let duplicateCount = 0

  for (const filename of pdfFiles) {
    const filePath = resolve(process.cwd(), filename)
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filename} not found, skipping.`)
      continue
    }

    const dataBuffer = fs.readFileSync(filePath)
    
    try {
      const parser = new PDFParse({ data: dataBuffer })
      const textResult = await parser.getText()
      const lines = textResult.text.split('\n').map(l => l.trim())
      
      // 1. Detect statement month and year
      let stmtYear = 2026
      let stmtMonth = 1
      for (const line of lines) {
        const match = line.match(/EXTRACTO DE\s+(\w+)\s+(\d{4})/)
        if (match) {
          const monthName = match[1].toUpperCase()
          stmtYear = parseInt(match[2])
          stmtMonth = MONTH_MAP[monthName] || 1
          break
        }
      }

      console.log(`Processing file ${filename}: Statement ${stmtMonth}/${stmtYear}`)
      let fileTxCount = 0

      // 2. Parse lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const txMatch = line.match(/^(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\s+(.*)$/)
        if (txMatch) {
          const opDay = txMatch[1]
          const opMonthStr = txMatch[2]
          const opMonth = parseInt(opMonthStr)
          const valDay = txMatch[3]
          const valMonth = parseInt(txMatch[4])
          const concept = txMatch[5]
          
          const details = lines[i + 1] || ''
          const amtLine = lines[i + 2] || ''
          const amtMatch = amtLine.match(/^([-\d\.,]+)\s+([-\d\.,]+)$/)
          
          if (amtMatch) {
            const rawAmount = amtMatch[1]
            const rawBalance = amtMatch[2]
            
            let cleanAmount = rawAmount.replace(/\./g, '').replace(/,/g, '.')
            const parsedAmount = parseFloat(cleanAmount)
            
            let txYear = stmtYear
            if (opMonth === 12 && stmtMonth === 1) {
              txYear = stmtYear - 1
            } else if (opMonth === 1 && stmtMonth === 12) {
              txYear = stmtYear + 1
            }
            
            const date = `${txYear}-${opMonthStr}-${opDay}`
            const type = parsedAmount > 0 ? 'income' : 'expense'
            const amount = Math.abs(parsedAmount)
            
            const cleanDet = cleanDetails(details)
            let description = concept
            const isGenericConcept = /^(pago con tarjeta|otros|transferencias|cargo por compra con tarjeta|cargo por amortizacion de prestamo|cargo por comision)/i.test(concept)
            
            if (cleanDet) {
              if (isGenericConcept) {
                description = cleanDet
              } else {
                description = `${concept} - ${cleanDet}`
              }
            }

            const tempTx = { date, amount, type, original_description: description }
            const key = transactionDuplicateKey(tempTx)

            if (existingKeys.has(key)) {
              duplicateCount++
              i += 2
              continue
            }

            // Guess category
            const guessedName = guessCategoryName(description, type)
            // check if name is mapped in DB (e.g. Restaurantes / Bares -> check mapping or default)
            let dbCatName = guessedName
            if (guessedName === 'Restaurantes / Bares' && !categoryByNameAndType.has('restaurantes / bares|expense')) {
              // fallback to Ocio or Compras if not found
              dbCatName = categoryByNameAndType.has('ocio|expense') ? 'Ocio' : 'Compras'
            }

            const categoryId = categoryByNameAndType.get(`${dbCatName.toLowerCase()}|${type}`)

            toInsert.push({
              user_id: user.id,
              amount,
              date,
              description,
              original_description: description,
              category_id: categoryId || dbCategories.find(c => c.type === type)?.id,
              type
            })

            fileTxCount++
            i += 2 // skip parsed details and amount lines
          }
        }
      }

      console.log(`Parsed ${fileTxCount} new transactions from ${filename}.`)
    } catch (err) {
      console.error(`Error parsing file ${filename}:`, err)
    }
  }

  console.log(`Total parsed from all PDFs: ${toInsert.length} new transactions to insert, ${duplicateCount} duplicates skipped.`)

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('transactions').insert(toInsert)
    if (insertError) {
      console.error("Error inserting transactions:", insertError)
      process.exit(1)
    }
    console.log("Successfully imported all new transactions into Supabase!")
  } else {
    console.log("No new transactions to insert.")
  }
}

run()
