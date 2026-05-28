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
  // Ingresos
  { name: 'Salario', type: 'income' as const, color_code: '#22C55E' },
  { name: 'Transferencia', type: 'income' as const, color_code: '#06B6D4' },
  { name: 'Bizum', type: 'income' as const, color_code: '#14B8A6' },
  { name: 'Otros ingresos', type: 'income' as const, color_code: '#A3E635' },

  // Gastos
  { name: 'Supermercado', type: 'expense' as const, color_code: '#F97316' },
  { name: 'Restaurantes / Bares', type: 'expense' as const, color_code: '#EF4444' },
  { name: 'Ocio', type: 'expense' as const, color_code: '#EAB308' },
  { name: 'Suscripción Apps', type: 'expense' as const, color_code: '#8B5CF6' },
  { name: 'Gasolinera', type: 'expense' as const, color_code: '#F59E0B' },
  { name: 'Compra Online', type: 'expense' as const, color_code: '#A855F7' },
  { name: 'Ropa o Complementos', type: 'expense' as const, color_code: '#EC4899' },
  { name: 'Telefonía / Internet', type: 'expense' as const, color_code: '#06B6D4' },
  { name: 'Retiro Efectivo', type: 'expense' as const, color_code: '#64748B' },
  { name: 'Bizum enviado', type: 'expense' as const, color_code: '#F43F5E' },
  { name: 'Transpasos', type: 'expense' as const, color_code: '#0EA5E9' },
  { name: 'Compras', type: 'expense' as const, color_code: '#94A3B8' },
  { name: 'Salud', type: 'expense' as const, color_code: '#10B981' },
  { name: 'Otros gastos', type: 'expense' as const, color_code: '#94A3B8' },
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

export function normalizeFinanceText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function transactionDuplicateKey(
  transaction: {
    date: string
    amount: number | string
    type: string
    description?: string
    original_description?: string
  }
): string {
  return [
    transaction.date,
    Number(transaction.amount).toFixed(2),
    transaction.type,
    normalizeFinanceText(transaction.original_description || transaction.description || ''),
  ].join('|')
}

export function guessOptimizedCategoryName(
  description: string,
  type: TransactionType
): string {
  const desc = normalizeFinanceText(description)

  if (type === 'income') {
    if (desc.includes('bizum') || desc.includes('recibido:')) return 'Bizum'
    if (desc.includes('nomina') || desc.includes('salario') || desc.includes('pension')) return 'Salario'
    if (desc.includes('transferencia') || desc.includes('pablo') || desc.includes('recibida')) return 'Transferencia'
    return 'Otros ingresos'
  }

  // Gastos
  if (desc.includes('bizum') || desc.includes('enviado:')) return 'Bizum enviado'
  if (desc.includes('ret. efectivo') || desc.includes('cajero') || desc.includes('retiro')) return 'Retiro Efectivo'
  if (desc.includes('transferencia realizada') || desc.includes('traspaso') || desc.includes('adeudo traspaso')) return 'Transpasos'
  
  if (/(mercadona|carrefour|lidl|alcampo|dia |ahorramas|consum|eroski|aldi|hipercor|gadis|146\.ga)/.test(desc)) return 'Supermercado'
  
  if (/(pizzeria|bar |restaurante|novo bandua|selecta|bocata|telepizza|mcdonald|burger|glovo|just eat|uber eats|vips|xoldra|pizza)/.test(desc)) {
    return 'Restaurantes / Bares'
  }
  
  if (/(repsol|waylet|cepsa|galp|shell|bp|gasolinera)/.test(desc)) return 'Gasolina'
  
  if (/(renfe|alvia|ave |metro|emt |taxi|cabify|uber|peaje|aparcamiento|parking)/.test(desc)) return 'Otros gastos'
  
  if (/(zara)/.test(desc)) return 'Ropa o Complementos'
  
  if (/(decathlon|amazon|cofidis)/.test(desc)) {
    return desc.includes('amazon') ? 'Compra Online' : 'Compras'
  }
  
  if (/(apple.com|suno|netflix|spotify|hbo|disney|youtube|steam|paypal|gemini|google one|apple music)/.test(desc)) {
    return 'Suscripción Apps'
  }
  
  if (/(telefonica|movistar|vodafone|orange|digi|iberdrola|endesa|naturgy|recibo|adeudo)/.test(desc)) {
    if (desc.includes('telefonica') || desc.includes('movistar') || desc.includes('vodafone') || desc.includes('orange') || desc.includes('digi')) {
      return 'Telefonía / Internet'
    }
    return 'Otros gastos'
  }
  
  if (/(farmacia|medico|clinica|dentista)/.test(desc)) return 'Salud'
  if (/(cine|teatro|concierto|entrada|libreria|cousas)/.test(desc)) return 'Ocio'
  
  return 'Otros gastos'
}
