import XLSX from 'xlsx'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
const workbook = XLSX.readFile(filePath)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

console.log('Index | Fecha | Concepto | Importe | Disponible')
console.log('--------------------------------------------------')
for (let i = 5; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 7) continue
  console.log(`${i} | ${row[1]} | ${row[2]} | ${row[4]} | ${row[6]}`)
}
