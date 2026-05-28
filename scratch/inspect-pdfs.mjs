import { PDFParse } from 'pdf-parse'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const pdfFiles = [
  '16f84114-da20-4298-a5ae-ea07b53118a2.pdf',
  '65bc51af-69ca-40b1-9fb1-54c3e6f522e2.pdf',
  '729e91e7-27fe-493b-9bb5-a7b25d683ffa.pdf',
  '7fd10182-6b0f-41a7-8b4b-46dddf61089f.pdf'
]

const MONTH_MAP = {
  'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
  'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}

async function run() {
  for (const filename of pdfFiles) {
    const filePath = resolve(process.cwd(), filename)
    if (!existsSync(filePath)) {
      console.log(`File not found: ${filename}`)
      continue
    }

    const dataBuffer = readFileSync(filePath)
    const parser = new PDFParse({ data: dataBuffer })
    const textResult = await parser.getText()
    const lines = textResult.text.split('\n').map(l => l.trim())

    let stmtYear = null
    let stmtMonth = null
    for (const line of lines) {
      const match = line.match(/EXTRACTO DE\s+(\w+)\s+(\d{4})/)
      if (match) {
        const monthName = match[1].toUpperCase()
        stmtYear = parseInt(match[2])
        stmtMonth = MONTH_MAP[monthName] || 1
        break
      }
    }

    console.log(`\nFile: ${filename}`)
    console.log(`Statement Month: ${stmtMonth}/${stmtYear}`)

    // Count transaction patterns
    let txCount = 0
    let balanceRange = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const txMatch = line.match(/^(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\s+(.*)$/)
      if (txMatch) {
        const details = lines[i + 1] || ''
        const amtLine = lines[i + 2] || ''
        const amtMatch = amtLine.match(/^([-\d\.,]+)\s+([-\d\.,]+)$/)
        if (amtMatch) {
          txCount++
          balanceRange.push(amtMatch[2]) // available balance after transaction
          i += 2
        }
      }
    }
    console.log(`Parsed transactions: ${txCount}`)
    if (balanceRange.length > 0) {
      console.log(`First balance: ${balanceRange[0]}`)
      console.log(`Last balance: ${balanceRange[balanceRange.length - 1]}`)
    }
  }
}

run()
