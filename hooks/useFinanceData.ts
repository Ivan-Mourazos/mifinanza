'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSupabase } from '@/components/SupabaseProvider'
import { useFinanceCore } from '@/context/FinanceContext'
import {
  fetchTransactionTotals,
  fetchTransactions,
  TransactionQuery,
  TransactionTotals,
} from '@/lib/finance-api'
import { Transaction } from '@/lib/types'

type UseFinanceDataOptions = {
  transactions?: TransactionQuery
  includeTransactionTotals?: boolean
  enabled?: boolean
}

export function useFinanceData(options: UseFinanceDataOptions = {}) {
  const {
    transactions: transactionQuery,
    includeTransactionTotals = false,
    enabled = true,
  } = options
  const router = useRouter()
  const { user, loading: authLoading } = useSupabase()
  const core = useFinanceCore()
  const supabase = useMemo(() => createClient(), [])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionTotals, setTransactionTotals] = useState<TransactionTotals>({
    income: 0,
    expense: 0,
    balance: 0,
  })
  const [txLoading, setTxLoading] = useState(Boolean(transactionQuery))
  const [totalsLoading, setTotalsLoading] = useState(includeTransactionTotals)
  const [txError, setTxError] = useState<string | null>(null)
  const [totalsError, setTotalsError] = useState<string | null>(null)

  const transactionQueryKey = transactionQuery
    ? `${transactionQuery.from ?? ''}|${transactionQuery.to ?? ''}|${transactionQuery.limit ?? ''}`
    : ''

  const memoizedQuery = useMemo(() => {
    if (!transactionQuery) return undefined
    return {
      from: transactionQuery.from,
      to: transactionQuery.to,
      limit: transactionQuery.limit,
    }
  }, [transactionQueryKey])

  const refreshTransactions = useCallback(async () => {
    if (!user || !memoizedQuery) return

    setTxLoading(true)
    setTxError(null)

    const result = await fetchTransactions(supabase, user.id, memoizedQuery)

    if (result.error) {
      setTxError(result.error)
    } else {
      setTransactions(result.data)
    }

    setTxLoading(false)
  }, [supabase, memoizedQuery, user])

  const refreshTransactionTotals = useCallback(async () => {
    if (!user || !includeTransactionTotals) return

    setTotalsLoading(true)
    setTotalsError(null)

    const result = await fetchTransactionTotals(supabase, user.id)

    if (result.error) {
      setTotalsError(result.error)
    } else {
      setTransactionTotals(result.data)
    }

    setTotalsLoading(false)
  }, [includeTransactionTotals, supabase, user])

  useEffect(() => {
    if (authLoading || !enabled) return

    if (!user) {
      router.replace('/auth')
      return
    }

    if (transactionQuery) {
      refreshTransactions()
    } else {
      setTxLoading(false)
    }

    if (includeTransactionTotals) {
      refreshTransactionTotals()
    } else {
      setTotalsLoading(false)
    }
  }, [
    authLoading,
    enabled,
    includeTransactionTotals,
    refreshTransactionTotals,
    refreshTransactions,
    router,
    transactionQueryKey,
    user,
  ])

  const refresh = useCallback(async () => {
    await Promise.all([
      core.refreshCore(),
      refreshTransactions(),
      refreshTransactionTotals(),
    ])
  }, [core, refreshTransactionTotals, refreshTransactions])

  return {
    user,
    categories: core.categories,
    settings: core.settings,
    pots: core.pots,
    potMovements: core.potMovements,
    transactions,
    transactionTotals,
    categoryById: core.categoryById,
    potsWithBalances: core.potsWithBalances,
    totalPotsBalance: core.totalPotsBalance,
    loading: authLoading || core.coreLoading || txLoading || totalsLoading,
    error: txError || totalsError || core.coreError,
    refresh,
    refreshTransactions,
    refreshTransactionTotals,
    refreshCore: core.refreshCore,
    supabase,
  }
}
