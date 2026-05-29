import XLSX from 'xlsx'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), '2026Y-05M-28D-22_19_04-Últimos movimientos.xlsx')
const workbook = XLSX.readFile(filePath)
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

const baseNegatives = []
for (let i = 5; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length < 5) continue
  const amount = Number(row[4])
  if (amount < 0) {
    baseNegatives.push({
      concept: row[2],
      amount: Math.abs(amount)
    })
  }
}

// New transactions on May 29
const newTxs = [
  { concept: 'Apple.com/bill', amount: 0.99 },
  { concept: 'Revolut**6083*', amount: 10.00 },
  { concept: '146.ga.melide 2 melide ...', amount: 16.54 }
]

// Holds on May 28
const holds = [
  { concept: 'RETENCION COMPRAS A DISTANCIA', amount: 5.99 },
  { concept: 'RETENCION SERVICIOS VARIOS', amount: 29.77 }
]

// Excluded positive transactions that could act as negative adjustments (offsets)
const offsets = [
  { concept: 'Amazon refund', amount: -36.75 },
  { concept: 'Transfer received from self (Ivan)', amount: -75.00 }
]

// Combine all negative candidates
// We can select a subset of baseNegatives, some subset of newTxs, some subset of holds, and some subset of offsets
const target = 1030.68

console.log(`Base negatives sum: ${baseNegatives.reduce((s, x) => s + x.amount, 0).toFixed(2)}`)
console.log(`New May 29 txs sum: ${newTxs.reduce((s, x) => s + x.amount, 0).toFixed(2)}`)
console.log(`Holds sum: ${holds.reduce((s, x) => s + x.amount, 0).toFixed(2)}`)

// Let's generate all combinations of newTxs (2^3 = 8), holds (2^2 = 4), and offsets (2^2 = 4)
const newTxSubsets = [[]]
for (const t of newTxs) {
  const len = newTxSubsets.length
  for (let i = 0; i < len; i++) newTxSubsets.push(newTxSubsets[i].concat(t))
}

const holdSubsets = [[]]
for (const h of holds) {
  const len = holdSubsets.length
  for (let i = 0; i < len; i++) holdSubsets.push(holdSubsets[i].concat(h))
}

const offsetSubsets = [[]]
for (const o of offsets) {
  const len = offsetSubsets.length
  for (let i = 0; i < len; i++) offsetSubsets.push(offsetSubsets[i].concat(o))
}

console.log('Running search...')

// Meet in the middle for baseNegatives
const mid = Math.floor(baseNegatives.length / 2)
const left = baseNegatives.slice(0, mid)
const right = baseNegatives.slice(mid)

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

const leftSubsets = getSubsets(left)
const rightSubsets = getSubsets(right)
rightSubsets.sort((a, b) => a.sum - b.sum)

function findBaseNegativesSummingTo(tVal) {
  const results = []
  for (const leftSub of leftSubsets) {
    const needed = tVal - leftSub.sum
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

// Search across combinations
for (const nSub of newTxSubsets) {
  for (const hSub of holdSubsets) {
    for (const oSub of offsetSubsets) {
      const extraSum = nSub.reduce((s, x) => s + x.amount, 0) +
                       hSub.reduce((s, x) => s + x.amount, 0) +
                       oSub.reduce((s, x) => s + x.amount, 0)
      
      const targetSumForBase = target - extraSum
      const matches = findBaseNegativesSummingTo(targetSumForBase)
      
      if (matches.length > 0) {
        // We look for options that exclude the 300.00 transfer (which is very logical)
        // Let's filter matches where 300.00 is excluded
        const goodMatches = matches.filter(m => !m.some(x => x.concept.includes('Transferencia realizada') && x.amount === 300))
        if (goodMatches.length > 0) {
          console.log(`\nMatch found!`)
          console.log(`  Added new May 29 txs: [${nSub.map(x => `${x.concept} (${x.amount})`).join(', ')}]`)
          console.log(`  Added holds: [${hSub.map(x => `${x.concept} (${x.amount})`).join(', ')}]`)
          console.log(`  Added offsets (refunds/transfers): [${oSub.map(x => `${x.concept} (${x.amount})`).join(', ')}]`)
          console.log(`  Target sum from base Excel: ${targetSumForBase.toFixed(2)}`)
          console.log(`  Example Excluded from Excel:`)
          // Print what is excluded from the base negatives
          const m = goodMatches[0]
          const excluded = baseNegatives.filter(b => !m.includes(b))
          excluded.forEach(x => console.log(`    - ${x.concept} (${x.amount})`))
        }
      }
    }
  }
}
