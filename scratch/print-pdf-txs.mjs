import { PDFParse } from 'pdf-parse'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const pdfFiles = [
  '7fd10182-6b0f-41a7-8b4b-46dddf61089f.pdf', // Jan
  '65bc51af-69ca-40b1-9fb1-54c3e6f522e2.pdf', // Feb
  '16f84114-da20-4298-a5ae-ea07b53118a2.pdf', // Mar
  '729e91e7-27fe-493b-9bb5-a7b25d683ffa.pdf'  // Apr
]

const MONTH_MAP = {
  'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
  'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}

async function run() {
  for (const filename of pdfFiles) {
    const filePath = resolve(process.cwd(), filename)
    if (!existsSync(filePath)) continue

    const dataBuffer = readFileSync(filePath)
    const parser = new PDFParse({ data: dataBuffer })
    const textResult = await parser.getText()
    const lines = textResult.text.split('\n').map(l => l.trim())

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

    const txs = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const txMatch = line.match(/^(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\s+(.*)$/)
      if (txMatch) {
        const opDay = txMatch[1]
        const opMonthStr = txMatch[2]
        const opMonth = parseInt(opMonthStr)
        const concept = txMatch[5]
        
        const details = lines[i + 1] || ''
        const amtLine = lines[i + 2] || ''
        const amtMatch = amtLine.match(/^([-\d\.,]+)\s+([-\d\.,]+)$/)
        
        if (amtMatch) {
          const rawAmount = amtMatch[1]
          const rawBalance = amtMatch[2]
          
          let cleanAmount = rawAmount.replace(/\./g, '').replace(/,/g, '.')
          const parsedAmount = parseFloat(cleanAmount)
          let cleanBalance = rawBalance.replace(/\./g, '').replace(/,/g, '.')
          const parsedBalance = parseFloat(cleanBalance)
          
          txs.push({
            date: `${stmtYear}-${opMonthStr}-${opDay}`,
            concept,
            amount: parsedAmount,
            balance: parsedBalance
          })
          i += 2
        }
      }
    }

    console.log(`\n=== File: ${filename} (Month ${stmtMonth}/${stmtYear}) ===`)
    console.log("Newest 3 transactions in PDF:")
    txs.slice(0, 3).forEach(t => console.log(`  ${t.date} | amt: ${t.amount} | bal: ${t.balance} | ${t.concept}`))
    console.log("Oldest 3 transactions in PDF:")
    txs.slice(-3).forEach(t => console.log(`  ${t.date} | amt: ${t.amount} | bal: ${t.balance} | ${t.concept}`))
  }
}

run()
