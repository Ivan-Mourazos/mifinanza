import XLSX from 'xlsx'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
const workbook = XLSX.readFile(filePath)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

console.log(`Total rows: ${rows.length}`)
for (let i = 0; i < rows.length; i++) {
  console.log(`Row ${i}:`, rows[i])
}
