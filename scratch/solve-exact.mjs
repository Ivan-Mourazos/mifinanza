import XLSX from 'xlsx'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
const workbook = XLSX.readFile(filePath)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

const transactions = []
for (let i = 5; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue
  const dateStr = row[1]
  const concept = row[2]
  const movement = row[3]
  const amount = Number(row[4])
  const parts = dateStr.split('/')
  const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
  
  transactions.push({
    date: formattedDate,
    concept,
    movement,
    amount
  })
}

// Add Nómina
transactions.push({
  date: '2026-05-29',
  concept: 'Nómina TGM',
  movement: 'Abono de nómina',
  amount: 1296.28
})

const positives = transactions.filter(t => t.amount > 0)
const negatives = transactions.filter(t => t.amount < 0).map(t => ({ ...t, amount: Math.abs(t.amount) }))

const bankIncome = 1369.28
const bankExpense = 1030.68

console.log('Positives (Incomes):')
positives.forEach((p, idx) => console.log(`  [P${idx}] ${p.date}: +${p.amount} | ${p.concept}`))

console.log('\nNegatives (Expenses):')
negatives.forEach((n, idx) => console.log(`  [N${idx}] ${n.date}: -${n.amount} | ${n.concept}`))

// Generate all subsets of positives to see if any are subtracted from expenses or excluded from income
const positiveSubsets = [[]]
for (const p of positives) {
  const len = positiveSubsets.length
  for (let i = 0; i < len; i++) {
    positiveSubsets.push(positiveSubsets[i].concat(p))
  }
}

// Meet-in-the-middle to find subsets of negatives that sum to target
// Split negatives into two halves
const mid = Math.floor(negatives.length / 2)
const left = negatives.slice(0, mid)
const right = negatives.slice(mid)

function getSubsets(arr) {
  const subsets = [{ sum: 0, items: [] }]
  for (const item of arr) {
    const len = subsets.length
    for (let i = 0; i < len; i++) {
      subsets.push({
        sum: subsets[i].sum + item.amount,
        items: subsets[i].items.concat(item)
      })
    }
  }
  return subsets
}

console.log('\nRunning meet-in-the-middle solver...')
const leftSubsets = getSubsets(left)
const rightSubsets = getSubsets(right)

// Map right sum to its items (using a tolerance of 0.005 for floats)
// We will sort rightSubsets by sum to do binary search or two-pointer search
rightSubsets.sort((a, b) => a.sum - b.sum)

function findNegativesSummingTo(target) {
  const results = []
  for (const leftSub of leftSubsets) {
    const needed = target - leftSub.sum
    // Binary search in rightSubsets
    let low = 0
    let high = rightSubsets.length - 1
    let foundIdx = -1
    while (low <= high) {
      const midIdx = Math.floor((low + high) / 2)
      const diff = rightSubsets[midIdx].sum - needed
      if (Math.abs(diff) < 0.005) {
        foundIdx = midIdx
        break
      } else if (diff < 0) {
        low = midIdx + 1
      } else {
        high = midIdx - 1
      }
    }
    
    if (foundIdx !== -1) {
      // Find all matches nearby (since multiple right subsets might have the same sum)
      let idx = foundIdx
      while (idx >= 0 && Math.abs(rightSubsets[idx].sum - needed) < 0.005) {
        results.push(leftSub.items.concat(rightSubsets[idx].items))
        idx--
      }
      idx = foundIdx + 1
      while (idx < rightSubsets.length && Math.abs(rightSubsets[idx].sum - needed) < 0.005) {
        results.push(leftSub.items.concat(rightSubsets[idx].items))
        idx++
      }
    }
  }
  return results
}

// 1. Solve Income
console.log('\n--- INCOME SOLVER ---')
// Find subsets of positives that sum to bankIncome
const matchingPos = []
for (const posSub of positiveSubsets) {
  const sum = posSub.reduce((s, x) => s + x.amount, 0)
  if (Math.abs(sum - bankIncome) < 0.005) {
    matchingPos.push(posSub)
  }
}
matchingPos.forEach((m, idx) => {
  const excluded = positives.filter(p => !m.includes(p))
  console.log(`Match ${idx + 1}:`)
  console.log(`  Included in Income: [${m.map(x => `${x.concept} (+${x.amount})`).join(', ')}]`)
  console.log(`  Excluded from Income: [${excluded.map(x => `${x.concept} (+${x.amount})`).join(', ')}]`)
})

// 2. Solve Expenses
console.log('\n--- EXPENSE SOLVER ---')
// We check if: Sum(Included_Negatives) - Sum(Subtracted_Positives) = bankExpense
// This is equivalent to: Sum(Included_Negatives) = bankExpense + Sum(Subtracted_Positives)
// Subtracted_Positives must be a subset of the EXCLUDED positives from the bank income (typically refund/transfer).
const excludedPositivesList = positives.filter(p => p.concept.includes('Amazon') || p.concept.includes('Transferencia recibida'))

// Subsets of excluded positives
const excludedPosSubsets = [[]]
for (const p of excludedPositivesList) {
  const len = excludedPosSubsets.length
  for (let i = 0; i < len; i++) {
    excludedPosSubsets.push(excludedPosSubsets[i].concat(p))
  }
}

for (const posSub of excludedPosSubsets) {
  const offset = posSub.reduce((s, x) => s + x.amount, 0)
  const targetSum = bankExpense + offset
  const matches = findNegativesSummingTo(targetSum)
  
  if (matches.length > 0) {
    console.log(`\nIf subtracted positives (refunds/returns) are: [${posSub.map(x => `${x.concept} (+${x.amount})`).join(', ')}] (offset: +${offset})`)
    console.log(`Target sum for included expenses: ${targetSum.toFixed(2)}`)
    console.log(`Found ${matches.length} matching expense subsets. Let's see what is EXCLUDED from expenses:`)
    matches.forEach((m, idx) => {
      const excluded = negatives.filter(n => !m.includes(n))
      console.log(`  Option ${idx + 1}: Excluded expenses:`)
      excluded.forEach(x => console.log(`    - ${x.date}: -${x.amount} | ${x.concept}`))
    })
  }
}
