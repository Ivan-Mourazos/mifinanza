import { SupabaseClient } from '@supabase/supabase-js'
import { defaultCategories } from '@/lib/finance'
import {
  Category,
  SavingPot,
  SavingPotMovement,
  Transaction,
  UserSettings,
} from '@/lib/types'

export type TransactionQuery = {
  from?: string
  to?: string
  limit?: number
}

export type FinanceFetchOptions = {
  transactions?: TransactionQuery
  seedCategories?: boolean
  seedPots?: boolean
  includeSettings?: boolean
  includePots?: boolean
  includeCategories?: boolean
}

export type FinanceData = {
  categories: Category[]
  transactions: Transaction[]
  settings: UserSettings | null
  pots: SavingPot[]
  potMovements: SavingPotMovement[]
}

export type TransactionTotals = {
  income: number
  expense: number
  balance: number
}

function isMissingSettings(error: { code?: string } | null) {
  return error?.code === 'PGRST116'
}

export async function ensureCategories(
  supabase: SupabaseClient,
  userId: string,
  seedIfEmpty: boolean
): Promise<{ data: Category[]; error: string | null }> {
  let response = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name')

  if (response.error) {
    return { data: [], error: 'No se pudieron cargar las categorías.' }
  }

  if ((!response.data || response.data.length === 0) && seedIfEmpty) {
    const insertResult = await supabase.from('categories').insert(
      defaultCategories.map((category) => ({
        user_id: userId,
        ...category,
      }))
    )

    if (insertResult.error) {
      return { data: [], error: 'No se pudieron crear las categorías iniciales.' }
    }

    response = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (response.error) {
      return { data: [], error: 'No se pudieron cargar las categorías iniciales.' }
    }
  }

  return { data: response.data || [], error: null }
}

export async function ensurePots(
  supabase: SupabaseClient,
  userId: string,
  seedIfEmpty: boolean
): Promise<{ data: SavingPot[]; error: string | null }> {
  const response = await supabase
    .from('saving_pots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (response.error) {
    return {
      data: [],
      error: 'No se pudieron cargar los apartados. Revisa que el SQL esté ejecutado en Supabase.',
    }
  }

  let pots = response.data || []

  if (pots.length === 0 && seedIfEmpty) {
    const insertResult = await supabase
      .from('saving_pots')
      .insert({
        user_id: userId,
        name: 'Apartado principal',
        target_amount: 0,
        color_code: '#00D9FF',
      })
      .select('*')
      .single()

    if (insertResult.error) {
      return { data: [], error: 'No se pudo preparar el apartado.' }
    }

    pots = insertResult.data ? [insertResult.data] : []
  }

  return { data: pots, error: null }
}

export async function fetchTransactions(
  supabase: SupabaseClient,
  userId: string,
  query: TransactionQuery = {}
): Promise<{ data: Transaction[]; error: string | null }> {
  let request = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (query.from) request = request.gte('date', query.from)
  if (query.to) request = request.lte('date', query.to)
  if (query.limit) request = request.limit(query.limit)

  const response = await request

  if (response.error) {
    return { data: [], error: 'No se pudieron cargar los movimientos.' }
  }

  return { data: response.data || [], error: null }
}

export type DescriptionSuggestionRow = {
  description: string
  category_id: string
  type: string
}

export async function fetchDescriptionSuggestions(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: DescriptionSuggestionRow[]; error: string | null }> {
  const response = await supabase
    .from('transactions')
    .select('description, category_id, type')
    .eq('user_id', userId)
    .not('description', 'is', null)
    .neq('description', '')
    .order('date', { ascending: false })

  if (response.error) {
    return { data: [], error: null } // non-critical — fail silently
  }

  return { data: response.data || [], error: null }
}

export async function fetchTransactionTotals(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: TransactionTotals; error: string | null }> {
  const emptyTotals = { income: 0, expense: 0, balance: 0 }

  // 1. Intentar usar la función RPC optimizada
  const rpcResponse = await supabase
    .rpc('get_user_transaction_totals', { user_id_param: userId })
    .maybeSingle()

  if (!rpcResponse.error && rpcResponse.data) {
    const data = rpcResponse.data as any
    return {
      data: {
        income: Number(data.income || 0),
        expense: Number(data.expense || 0),
        balance: Number(data.balance || 0),
      },
      error: null,
    }
  }

  // 2. Si el RPC falla porque no existe, hacemos fallback al método anterior de sumas en cliente
  const isMissingFunction = rpcResponse.error && 
    (rpcResponse.error.code === 'PGRST202' || rpcResponse.status === 404 || rpcResponse.error.message?.includes('does not exist'))

  if (isMissingFunction) {
    const response = await supabase
      .from('transactions')
      .select('amount,type')
      .eq('user_id', userId)

    if (response.error) {
      return { data: emptyTotals, error: 'No se pudo calcular el saldo total.' }
    }

    const totals = (response.data || []).reduce(
      (currentTotals, transaction) => {
        const amount = Number(transaction.amount)

        if (transaction.type === 'income') {
          currentTotals.income += amount
        } else {
          currentTotals.expense += amount
        }

        currentTotals.balance = currentTotals.income - currentTotals.expense
        return currentTotals
      },
      { ...emptyTotals }
    )

    return { data: totals, error: null }
  }

  return { data: emptyTotals, error: 'No se pudo calcular el saldo total.' }
}

export async function fetchSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: UserSettings | null; error: string | null }> {
  const response = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (response.error && !isMissingSettings(response.error)) {
    return { data: null, error: 'No se pudieron cargar los ajustes.' }
  }

  return { data: response.data || null, error: null }
}

export async function fetchPotMovements(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: SavingPotMovement[]; error: string | null }> {
  const response = await supabase
    .from('saving_pot_movements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (response.error) {
    return { data: [], error: 'No se pudieron cargar los movimientos de apartados.' }
  }

  return { data: response.data || [], error: null }
}

export async function fetchFinanceData(
  supabase: SupabaseClient,
  userId: string,
  options: FinanceFetchOptions
): Promise<{ data: FinanceData; error: string | null }> {
  const data: FinanceData = {
    categories: [],
    transactions: [],
    settings: null,
    pots: [],
    potMovements: [],
  }

  const tasks: Promise<void>[] = []

  if (options.includeCategories !== false) {
    tasks.push(
      ensureCategories(supabase, userId, Boolean(options.seedCategories)).then(
        (result) => {
          if (result.error) throw new Error(result.error)
          data.categories = result.data
        }
      )
    )
  }

  if (options.includeSettings) {
    tasks.push(
      fetchSettings(supabase, userId).then((result) => {
        if (result.error) throw new Error(result.error)
        data.settings = result.data
      })
    )
  }

  if (options.includePots) {
    tasks.push(
      ensurePots(supabase, userId, Boolean(options.seedPots)).then((result) => {
        if (result.error) throw new Error(result.error)
        data.pots = result.data
      }),
      fetchPotMovements(supabase, userId).then((result) => {
        if (result.error) throw new Error(result.error)
        data.potMovements = result.data
      })
    )
  }

  if (options.transactions) {
    tasks.push(
      fetchTransactions(supabase, userId, options.transactions).then((result) => {
        if (result.error) throw new Error(result.error)
        data.transactions = result.data
      })
    )
  }

  try {
    await Promise.all(tasks)
    return { data, error: null }
  } catch (error) {
    return {
      data,
      error: error instanceof Error ? error.message : 'No se pudieron cargar tus datos.',
    }
  }
}
