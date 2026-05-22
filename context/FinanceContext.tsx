'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabase } from '@/components/SupabaseProvider'
import {
  ensureCategories,
  ensurePots,
  fetchPotMovements,
  fetchSettings,
} from '@/lib/finance-api'
import { buildCategoryMap, buildPotSummaries } from '@/lib/finance-selectors'
import {
  Category,
  SavingPot,
  SavingPotMovement,
  UserSettings,
} from '@/lib/types'

type FinanceCoreContextValue = {
  categories: Category[]
  settings: UserSettings | null
  pots: SavingPot[]
  potMovements: SavingPotMovement[]
  categoryById: Map<string, Category>
  potsWithBalances: ReturnType<typeof buildPotSummaries>['potsWithBalances']
  totalPotsBalance: number
  coreLoading: boolean
  coreError: string | null
  refreshCore: (options?: { seedCategories?: boolean; seedPots?: boolean }) => Promise<void>
}

const FinanceContext = createContext<FinanceCoreContextValue | null>(null)

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useSupabase()
  const supabase = useMemo(() => createClient(), [])
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [pots, setPots] = useState<SavingPot[]>([])
  const [potMovements, setPotMovements] = useState<SavingPotMovement[]>([])
  const [coreLoading, setCoreLoading] = useState(true)
  const [coreError, setCoreError] = useState<string | null>(null)
  const loadedForUser = useRef<string | null>(null)

  const refreshCore = useCallback(
    async (options?: { seedCategories?: boolean; seedPots?: boolean }) => {
      if (!user) return

      setCoreError(null)
      setCoreLoading(true)

      const [categoriesResult, settingsResult, potsResult, potMovementsResult] =
        await Promise.all([
          ensureCategories(supabase, user.id, Boolean(options?.seedCategories)),
          fetchSettings(supabase, user.id),
          ensurePots(supabase, user.id, Boolean(options?.seedPots)),
          fetchPotMovements(supabase, user.id),
        ])

      const error =
        categoriesResult.error ||
        settingsResult.error ||
        potsResult.error ||
        potMovementsResult.error

      if (error) {
        setCoreError(error)
      } else {
        setCategories(categoriesResult.data)
        setSettings(settingsResult.data)
        setPots(potsResult.data)
        setPotMovements(potMovementsResult.data)
        loadedForUser.current = user.id
      }

      setCoreLoading(false)
    },
    [supabase, user]
  )

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      loadedForUser.current = null
      setCategories([])
      setSettings(null)
      setPots([])
      setPotMovements([])
      setCoreLoading(false)
      setCoreError(null)
      return
    }

    if (loadedForUser.current === user.id) {
      setCoreLoading(false)
      return
    }

    refreshCore({ seedCategories: true, seedPots: true })
  }, [authLoading, refreshCore, user])

  const categoryById = useMemo(() => buildCategoryMap(categories), [categories])
  const { potsWithBalances, totalPotsBalance } = useMemo(
    () => buildPotSummaries(pots, potMovements),
    [potMovements, pots]
  )

  const value = useMemo(
    () => ({
      categories,
      settings,
      pots,
      potMovements,
      categoryById,
      potsWithBalances,
      totalPotsBalance,
      coreLoading,
      coreError,
      refreshCore,
    }),
    [
      categories,
      categoryById,
      coreError,
      coreLoading,
      potMovements,
      pots,
      potsWithBalances,
      refreshCore,
      settings,
      totalPotsBalance,
    ]
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinanceCore() {
  const context = useContext(FinanceContext)

  if (!context) {
    throw new Error('useFinanceCore debe usarse dentro de FinanceProvider')
  }

  return context
}
