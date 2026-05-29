import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const email = process.env.MIFINANZA_ADMIN_EMAIL
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  const uid = user.id

  const { data: txs } = await supabase
    .from('transactions')
    .select('date, amount, type, description, category_id')
    .eq('user_id', uid)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')

  const expenses = txs.filter(t => t.type === 'expense').map(t => ({ ...t, amount: Number(t.amount) }))
  const incomes = txs.filter(t => t.type === 'income').map(t => ({ ...t, amount: Number(t.amount) }))

  console.log(`DB Total Expenses: ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}`)
  console.log(`DB Total Incomes: ${incomes.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}`)

  // Bank values
  const targetIncome = 1369.28
  const targetExpense = 1030.68

  console.log('\n--- FINDING INCOME SUBSETS ---')
  // We want to find a subset of incomes and/or negative incomes (or refunds) that sums to targetIncome
  // Let's do a simple recursive finder for income subset
  function findSubsets(arr, target, partial = [], start = 0) {
    const sum = partial.reduce((s, x) => s + x.amount, 0)
    if (Math.abs(sum - target) < 0.01) {
      console.log('Match found:', partial.map(p => `${p.date}: ${p.amount} (${p.description})`).join(' + '))
      return
    }
    if (sum > target + 10) return // prune
    for (let i = start; i < arr.length; i++) {
      findSubsets(arr, target, partial.concat(arr[i]), i + 1)
    }
  }
  findSubsets(incomes, targetIncome)

  console.log('\n--- FINDING EXPENSE SUBSETS (exactly matching bank expense) ---')
  // Let's find subsets of expenses that sum to targetExpense
  function findExpenseSubsets(arr, target, partial = [], start = 0) {
    const sum = partial.reduce((s, x) => s + x.amount, 0)
    if (Math.abs(sum - target) < 0.01) {
      console.log('Match found:', partial.map(p => `${p.date}: -${p.amount} (${p.description})`).join(' + '))
      return
    }
    if (sum > target + 10) return // prune
    for (let i = start; i < arr.length; i++) {
      findExpenseSubsets(arr, target, partial.concat(arr[i]), i + 1)
    }
  }
  findExpenseSubsets(expenses, targetExpense)

  console.log('\n--- FINDING EXPENSE SUBSETS (with refund/income offset) ---')
  // Sometimes a refund (income with category Devoluciones, etc.) is subtracted from expenses.
  // Or maybe a transfer is subtracted.
  // Let's try matching: sum(expenses_subset) - sum(incomes_subset) = targetExpense
  // Specifically, let's try with refund (+36.75) and transfer (+75.00)
  const potentialOffsets = [0, 36.75, 75.00, 36.75 + 75.00]
  for (const offset of potentialOffsets) {
    console.log(`If offset from expenses is ${offset} (i.e. target sum is ${targetExpense + offset}):`)
    findExpenseSubsets(expenses, targetExpense + offset)
  }
}

run().catch(console.error)
