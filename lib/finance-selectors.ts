import { getPotsWithBalances, getTotalPotsBalance } from '@/lib/finance'
import { Category, SavingPot, SavingPotMovement } from '@/lib/types'

export function buildCategoryMap(categories: Category[]) {
  return new Map(categories.map((category) => [category.id, category]))
}

export function buildPotSummaries(pots: SavingPot[], potMovements: SavingPotMovement[]) {
  const potsWithBalances = getPotsWithBalances(pots, potMovements)
  const totalPotsBalance = getTotalPotsBalance(potsWithBalances)

  return { potsWithBalances, totalPotsBalance }
}
