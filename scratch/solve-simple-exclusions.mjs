import XLSX from 'xlsx'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
const workbook = XLSX.readFile(filePath)
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

const negatives = []
for (let i = 5; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue
  const amount = Number(row[4])
  if (amount < 0) {
    negatives.push({
      date: row[1],
      concept: row[2],
      amount: Math.abs(amount)
    })
  }
}

// We want to find a subset of size <= 5 that sums to exactly `target`
function findSmallSubset(target, label) {
  console.log(`\n=== Exclusions summing to exactly ${target} (${label}) ===`)
  
  const results = []
  
  function backtrack(index, currentSum, path) {
    if (Math.abs(currentSum - target) < 0.015) {
      results.push([...path])
      return
    }
    if (currentSum > target + 0.05) return
    if (path.length >= 5) return
    if (index >= negatives.length) return
    
    // Include
    backtrack(index + 1, currentSum + negatives[index].amount, path.concat(negatives[index]))
    // Exclude
    backtrack(index + 1, currentSum, path)
  }
  
  backtrack(0, 0, [])
  
  if (results.length === 0) {
    console.log("No small subsets found.")
  } else {
    results.forEach((r, idx) => {
      console.log(`  Match ${idx + 1}: [${r.map(x => `${x.date}: ${x.concept} (${x.amount})`).join(', ')}]`)
    })
  }
}

// Let's test different hypotheses for the bank's expenses:
// 1. Bank excludes a subset of expenses summing to 269.22
findSmallSubset(269.22, "Standard exclusions")

// 2. Bank excludes a subset and also subtracts the Amazon refund of 36.75 from expenses
// Bank_Expenses = DB_Expenses - Excluded_Expenses - 36.75 = 1030.68
// Excluded_Expenses = DB_Expenses - 1030.68 - 36.75 = 269.22 - 36.75 = 232.47
findSmallSubset(232.47, "Exclusions if 36.75 refund reduces expenses")

// 3. Bank excludes a subset and subtracts the 75.00 transfer from expenses
// Excluded_Expenses = 269.22 - 75.00 = 194.22
findSmallSubset(194.22, "Exclusions if 75.00 transfer reduces expenses")

// 4. Bank excludes a subset and subtracts both 36.75 and 75.00 from expenses
// Excluded_Expenses = 269.22 - 36.75 - 75.00 = 157.47
findSmallSubset(157.47, "Exclusions if both refund and transfer reduce expenses")

// 5. What if the bank excludes the 300.00 transfer (too big for the 269.22 difference, so it must be that the bank app actually has HIGHER expenses but some other negative adjustment happened)
// Let's see: if the bank excludes 300.00, then Excluded_Expenses must contain 300.00.
// But the difference is 269.22, so:
// DB_Expenses - 300.00 (Excluded) + 30.78 (Adjustment) = 1030.68
// Wait, is there a subset of positives/negatives that equals 30.78?
// Let's see: is there a small subset of negatives that sums to 30.78?
findSmallSubset(30.78, "Negative adjustment needed if 300.00 is excluded")

// What if the bank excludes 300.00 and the Amazon refund of 36.75 is subtracted?
// DB_Expenses - 300.00 (Excluded) - 36.75 (Refund) + 67.53 = 1030.68
// What if the bank excludes 300.00 and the 75.00 transfer is subtracted?
// DB_Expenses - 300.00 (Excluded) - 75.00 (Transfer) + 105.78 = 1030.68
// What if the bank excludes 300.00 and both are subtracted?
// DB_Expenses - 300.00 (Excluded) - 36.75 (Refund) - 75.00 (Transfer) + 142.53 = 1030.68
findSmallSubset(142.53, "Adjustment if 300.00 excluded and both subtracted")
