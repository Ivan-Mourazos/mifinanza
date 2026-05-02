import {
  Category,
  CategoryBreakdownItem,
  SavingPot,
  SavingPotMovement,
  SavingPotWithBalance,
  Transaction,
  TransactionType,
} from './types'

export const DEFAULT_CURRENCY = 'EUR'
export const DEFAULT_LOCALE = 'es-ES'

export const defaultCategories = [
  { name: 'Salario', type: 'income' as const, color_code: '#00FF88' },
  { name: 'Freelance', type: 'income' as const, color_code: '#00FF88' },
  { name: 'Inversiones', type: 'income' as const, color_code: '#00FF88' },
  { name: 'Otro ingreso', type: 'income' as const, color_code: '#00FF88' },
  { name: 'Comida', type: 'expense' as const, color_code: '#FF2D55' },
  { name: 'Transporte', type: 'expense' as const, color_code: '#FF6B6B' },
  { name: 'Servicios', type: 'expense' as const, color_code: '#FF6B6B' },
  { name: 'Entretenimiento', type: 'expense' as const, color_code: '#FF6B6B' },
  { name: 'Otros gastos', type: 'expense' as const, color_code: '#FF6B6B' },
]

export function formatCurrency(
  amount: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE
) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function getTotals(transactions: Transaction[]) {
  return transactions.reduce(
    (totals, transaction) => {
      const amount = Number(transaction.amount)

      if (transaction.type === 'income') {
        totals.income += amount
      } else {
        totals.expense += amount
      }

      totals.balance = totals.income - totals.expense
      return totals
    },
    { income: 0, expense: 0, balance: 0 }
  )
}

export function getCategoryBreakdown(
  transactions: Transaction[],
  categories: Map<string, Pick<Category, 'name' | 'color_code'>>,
  type: TransactionType
): CategoryBreakdownItem[] {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== type) continue
    totals.set(
      transaction.category_id,
      (totals.get(transaction.category_id) || 0) + Number(transaction.amount)
    )
  }

  return Array.from(totals.entries())
    .map(([categoryId, value]) => {
      const category = categories.get(categoryId)

      return {
        id: categoryId,
        name: category?.name || 'Sin categoría',
        value,
        color: category?.color_code || '#666',
      }
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function getPotBalance(movements: SavingPotMovement[], potId: string) {
  return movements.reduce((balance, movement) => {
    if (movement.pot_id !== potId) return balance

    const amount = Number(movement.amount)
    return movement.type === 'deposit' ? balance + amount : balance - amount
  }, 0)
}

export function getPotsWithBalances(
  pots: SavingPot[],
  movements: SavingPotMovement[]
): SavingPotWithBalance[] {
  return pots.map((pot) => {
    const balance = getPotBalance(movements, pot.id)
    const targetAmount = Number(pot.target_amount)

    return {
      ...pot,
      balance,
      target_amount: targetAmount,
      progress: targetAmount > 0 ? Math.min((balance / targetAmount) * 100, 100) : 0,
    }
  })
}

export function getTotalPotsBalance(pots: SavingPotWithBalance[]) {
  return pots.reduce((total, pot) => total + pot.balance, 0)
}
