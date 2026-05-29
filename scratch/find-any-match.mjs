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
      concept: row[2],
      amount: Math.abs(amount)
    })
  }
}

// Add the 3 new ones
negatives.push({ concept: 'Apple.com/bill (29 May)', amount: 0.99 })
negatives.push({ concept: 'Revolut**6083* (29 May)', amount: 10.00 })
negatives.push({ concept: '146.ga.melide 2 (29 May)', amount: 16.54 })

// Add holds
negatives.push({ concept: 'PAGO CON TARJETA COMPRAS DISTANCIA (Hold)', amount: 5.99 })
negatives.push({ concept: 'PAGO CON TARJETA SERVICIOS VARIOS (Hold)', amount: 29.77 })

const target = 1030.68

// We want to find subsets of negatives that sum to target
// We use meet-in-the-middle
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

console.log('Generating subsets...')
const leftSubsets = getSubsets(left)
const rightSubsets = getSubsets(right)
rightSubsets.sort((a, b) => a.sum - b.sum)

console.log('Searching for exact match...')
const matches = []

for (const leftSub of leftSubsets) {
  const needed = target - leftSub.sum
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
      matches.push(leftSub.items.concat(rightSubsets[idx].items))
      idx--
    }
    idx = foundIdx + 1
    while (idx < rightSubsets.length && Math.abs(rightSubsets[idx].sum - needed) < 0.005) {
      matches.push(leftSub.items.concat(rightSubsets[idx].items))
      idx++
    }
  }
}

console.log(`Found ${matches.length} matches.`)

// Let's filter matches. We prefer ones that exclude the 300.00 transfer (since it's a transfer to self).
// Let's print the first 5 matches that exclude 300.00
const filteredMatches = matches.filter(m => !m.some(x => x.concept.includes('Transferencia realizada') && x.amount === 300))
console.log(`Matches excluding 300.00 transfer: ${filteredMatches.length}`)
filteredMatches.slice(0, 5).forEach((m, idx) => {
  console.log(`\nMatch ${idx + 1}:`)
  console.log(`  Included: [${m.map(x => `${x.concept} (${x.amount})`).join(', ')}]`)
  const excluded = negatives.filter(n => !m.includes(n))
  console.log(`  Excluded: [${excluded.map(x => `${x.concept} (${x.amount})`).join(', ')}]`)
})
