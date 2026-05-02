export type CategoryType = 'income' | 'expense'

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  color_code: string
  created_at?: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  date: string
  description: string
  category_id: string
  type: CategoryType
  created_at?: string
}

export interface TransactionWithCategory extends Transaction {
  categories?: Category
}

export interface Balance {
  total: number
  income: number
  expense: number
}