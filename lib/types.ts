export type TransactionType = 'income' | 'expense'
export type SavingPotMovementType = 'deposit' | 'withdrawal'

export interface Transaction {
  id: string
  user_id: string
  amount: number
  date: string
  description: string
  category_id: string
  type: TransactionType
  created_at?: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType
  color_code: string
  created_at?: string
}

export interface UserSettings {
  id: string
  user_id: string
  initial_balance: number
  currency: string
}

export interface CategoryBreakdownItem {
  id: string
  name: string
  value: number
  color: string
}

export interface SavingPot {
  id: string
  user_id: string
  name: string
  target_amount: number
  color_code: string
  created_at: string
  updated_at: string
}

export interface SavingPotMovement {
  id: string
  user_id: string
  pot_id: string
  amount: number
  type: SavingPotMovementType
  note: string
  created_at: string
}

export interface SavingPotWithBalance extends SavingPot {
  balance: number
  progress: number
}
