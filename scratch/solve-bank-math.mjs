import XLSX from 'xlsx'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
const workbook = XLSX.readFile(filePath)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

// Row 4 is header: ["F.Valor", "Fecha", "Concepto", "Movimiento", "Importe", "Divisa", "Disponible", "Divisa", "Observaciones"]
// Data is rows 5 to 44
const transactions = []
for (let i = 5; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue
  const dateStr = row[1] // e.g. "28/05/2026"
  const concept = row[2]
  const movement = row[3]
  const amount = Number(row[4])
  
  // parse date DD/MM/YYYY
  const parts = dateStr.split('/')
  const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
  
  transactions.push({
    date: formattedDate,
    concept,
    movement,
    amount
  })
}

// Add the Nómina TGM which is manually added on 2026-05-29
transactions.push({
  date: '2026-05-29',
  concept: 'Nómina TGM',
  movement: 'Abono de nómina',
  amount: 1296.28
})

console.log(`Loaded ${transactions.length} transactions for May 2026.`)

// Separate into positive and negative
const positives = transactions.filter(t => t.amount > 0)
const negatives = transactions.filter(t => t.amount < 0).map(t => ({ ...t, amount: Math.abs(t.amount) }))

console.log('\nPositives (Incomes):')
positives.forEach(p => console.log(`  ${p.date}: +${p.amount} | ${p.concept}`))

console.log('\nNegatives (Expenses):')
negatives.forEach(n => console.log(`  ${n.date}: -${n.amount} | ${n.concept}`))

const bankIncome = 1369.28
const bankExpense = 1030.68

// Let's find which positives sum to bankIncome
console.log('\n--- Checking positive combinations ---')
function findPos(arr, target, index = 0, current = 0, path = []) {
  if (Math.abs(current - target) < 0.01) {
    console.log(`MATCH INCOME:`, path.map(x => `${x.concept} (${x.amount})`).join(' + '))
    return
  }
  if (current > target + 1) return
  if (index >= arr.length) return
  findPos(arr, target, index + 1, current + arr[index].amount, path.concat(arr[index]))
  findPos(arr, target, index + 1, current, path)
}
findPos(positives, bankIncome)

// Let's find which negatives/positives combinations sum to bankExpense
console.log('\n--- Checking expense combinations ---')
// The bank might calculate expenses as: Sum(subset of negatives) - Sum(subset of positives) = bankExpense
// Or: Sum(subset of negatives) = bankExpense
// Let's try all subsets of negatives, and for each, try subtracting some subset of positives.
// Since positives is small (6 items), we can generate all subsets of positives.
const positiveSubsets = [[]]
for (const p of positives) {
  const len = positiveSubsets.length
  for (let i = 0; i < len; i++) {
    positiveSubsets.push(positiveSubsets[i].concat(p))
  }
}

console.log(`Generated ${positiveSubsets.length} subsets of positive transactions to try as offsets.`)

for (const posSub of positiveSubsets) {
  const offset = posSub.reduce((s, x) => s + x.amount, 0)
  const targetSum = bankExpense + offset
  
  // We want to find a subset of negatives that sums to targetSum
  const matches = []
  function findNeg(arr, target, index = 0, current = 0, path = []) {
    if (Math.abs(current - target) < 0.01) {
      matches.push(path)
      return
    }
    if (current > target + 1) return
    if (index >= arr.length) return
    findNeg(arr, target, index + 1, current + arr[index].amount, path.concat(arr[index]))
    findNeg(arr, target, index + 1, current, path)
  }
  
  findNeg(negatives, targetSum)
  if (matches.length > 0) {
    console.log(`\nIf positives subtracted from expenses are: [${posSub.map(x => `${x.concept} (${x.amount})`).join(', ')}] (offset: ${offset})`)
    console.log(`Target sum for negatives: ${targetSum.toFixed(2)}`)
    console.log(`Found ${matches.length} matching negative subsets:`)
    matches.slice(0, 3).forEach((m, idx) => {
      const excluded = negatives.filter(n => !m.includes(n))
      console.log(`  Option ${idx + 1}: Excluded negatives: [${excluded.map(x => `${x.concept} (${x.amount})`).join(', ')}]`)
    })
  }
}
