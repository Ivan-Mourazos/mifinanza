'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Navigation } from '@/components/Navigation'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { UserBadge } from '@/components/UserBadge'
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getCategoryBreakdown,
  getPotsWithBalances,
  getTotalPotsBalance,
  getTotals,
} from '@/lib/finance'
import { Category, SavingPot, SavingPotMovement, Transaction, UserSettings } from '@/lib/types'

const ExpensePieChart = dynamic(
  () => import('@/components/ExpensePieChart').then((mod) => mod.ExpensePieChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500 md:h-64">
        Cargando gráfico...
      </div>
    ),
  }
)

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pots, setPots] = useState<SavingPot[]>([])
  const [potMovements, setPotMovements] = useState<SavingPotMovement[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [newBalance, setNewBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const balanceInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    setError(null)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      setError('No se pudo comprobar tu sesión.')
      setLoading(false)
      return
    }

    if (!user) {
      setLoading(false)
      router.replace('/auth')
      return
    }

    setUser(user)

    const start = startOfMonth(new Date())
    const end = endOfMonth(new Date())

    const [transactionsRes, categoriesRes, settingsRes, potsRes, potMovementsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .order('date', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('saving_pots')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('saving_pot_movements')
        .select('*')
        .eq('user_id', user.id),
    ])

    const settingsError =
      settingsRes.error && settingsRes.error.code !== 'PGRST116' ? settingsRes.error : null
    const requestError =
      transactionsRes.error
        ? { source: 'movimientos', error: transactionsRes.error }
        : categoriesRes.error
          ? { source: 'categorías', error: categoriesRes.error }
          : settingsError
            ? { source: 'ajustes', error: settingsError }
            : potsRes.error
              ? { source: 'apartados', error: potsRes.error }
              : potMovementsRes.error
                ? { source: 'movimientos de apartados', error: potMovementsRes.error }
                : null

    if (requestError) {
      console.error(`Error cargando ${requestError.source}:`, requestError.error)
      setError(`No se pudieron cargar tus datos (${requestError.source}). Intenta de nuevo.`)
    }

    setTransactions(transactionsRes.data || [])
    setCategories(categoriesRes.data || [])
    setPots(potsRes.data || [])
    setPotMovements(potMovementsRes.data || [])
    setSettings(settingsRes.data || null)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveBalance = async () => {
    if (!user || !newBalance) return
    setSaving(true)
    setError(null)
    
    const balance = parseFloat(newBalance.replace(',', '.'))
    if (!Number.isFinite(balance)) {
      setError('Ingresa un balance válido.')
      setSaving(false)
      return
    }
    
    if (settings) {
      const { error } = await supabase.from('user_settings').update({
        initial_balance: balance,
        updated_at: new Date().toISOString()
      }).eq('id', settings.id)
      if (error) {
        setError('No se pudo guardar el balance.')
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('user_settings').insert({
        user_id: user.id,
        initial_balance: balance,
      })
      if (error) {
        setError('No se pudo guardar el balance.')
        setSaving(false)
        return
      }
    }
    
    await fetchData()
    setShowBalanceModal(false)
    setNewBalance('')
    setSaving(false)
  }

  useEffect(() => {
    if (!showBalanceModal) return

    balanceInputRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowBalanceModal(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showBalanceModal])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const { income, expense, balance: monthlyBalance } = useMemo(
    () => getTotals(transactions),
    [transactions]
  )
  const currency = settings?.currency || DEFAULT_CURRENCY
  const initialBalance = settings?.initial_balance || 0
  const accountBalance = initialBalance + monthlyBalance
  const potsWithBalances = useMemo(
    () => getPotsWithBalances(pots, potMovements),
    [potMovements, pots]
  )
  const totalPotsBalance = useMemo(
    () => getTotalPotsBalance(potsWithBalances),
    [potsWithBalances]
  )
  const availableBalance = accountBalance - totalPotsBalance
  const totalWorth = availableBalance + totalPotsBalance

  const expenseByCategory = useMemo(
    () => getCategoryBreakdown(transactions, categoryById, 'expense'),
    [categoryById, transactions]
  )
  const incomeByCategory = useMemo(
    () => getCategoryBreakdown(transactions, categoryById, 'income'),
    [categoryById, transactions]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-neonCyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Cargando tu resumen...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto max-w-lg p-4 space-y-6 md:max-w-3xl lg:max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <h1 className="text-2xl font-bold text-white mb-1">MiFinanza</h1>
          <p className="text-gray-500 text-sm">{format(new Date(), 'MMMM yyyy', { locale: es })}</p>
        </motion.div>

        <UserBadge user={user} />

        <motion.button
          onClick={() => {
            setNewBalance(String(initialBalance))
            setShowBalanceModal(true)
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full glass rounded-2xl p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neonCyan"
        >
          <p className="text-gray-400 text-sm mb-1">Saldo disponible</p>
          <p className={`text-4xl font-bold ${availableBalance >= 0 ? 'text-neonGreen' : 'text-neonMagenta'}`}>
            {formatCurrency(availableBalance, currency)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Saldo total con apartados: {formatCurrency(totalWorth, currency)}
          </p>
        </motion.button>

        {error && (
          <div className="rounded-2xl border border-neonMagenta/30 bg-neonMagenta/10 p-4 text-sm text-neonMagenta">
            <p>{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-gray-400 text-sm mb-1">Ingresos</p>
            <p className="text-xl font-semibold text-neonGreen">
              {formatCurrency(income, currency)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-gray-400 text-sm mb-1">Gastos</p>
            <p className="text-xl font-semibold text-neonMagenta">
              {formatCurrency(expense, currency)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-gray-400 text-sm mb-1">Apartado</p>
            <p className="text-xl font-semibold text-neonCyan">
              {formatCurrency(totalPotsBalance, currency)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-gray-400 text-sm mb-1">Saldo total</p>
            <p className="text-xl font-semibold text-white">
              {formatCurrency(totalWorth, currency)}
            </p>
          </motion.div>
        </div>

        {initialBalance > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-gray-400 text-sm mb-1">Balance Inicial</p>
            <p className="text-xl font-semibold text-neonCyan">
              {formatCurrency(initialBalance, currency)}
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {incomeByCategory.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-4"
            >
              <h3 className="text-gray-400 text-xs sm:text-sm mb-3">Ingresos por Categoría</h3>
              <ExpensePieChart data={incomeByCategory} currency={currency} />
              <div className="flex flex-wrap gap-2 mt-3">
                {incomeByCategory.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-gray-400 truncate">{cat.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="glass rounded-2xl p-4 text-center text-xs sm:text-sm text-gray-500">
              <p>Aún no hay ingresos por categoría este mes.</p>
            </div>
          )}

          {expenseByCategory.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass rounded-2xl p-4"
            >
              <h3 className="text-gray-400 text-xs sm:text-sm mb-3">Gastos por Categoría</h3>
              <ExpensePieChart data={expenseByCategory} currency={currency} />
              <div className="flex flex-wrap gap-2 mt-3">
                {expenseByCategory.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-gray-400 truncate">{cat.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="glass rounded-2xl p-4 text-center text-xs sm:text-sm text-gray-500">
              <p>Aún no hay gastos por categoría este mes.</p>
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-4"
        >
          <h3 className="text-gray-400 text-sm mb-3">Últimos Movimientos</h3>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Sin movimientos este mes. Añade uno para empezar.</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((t, i) => {
                const cat = categoryById.get(t.category_id)
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color_code || '#666' }} />
                      <div>
                        <p className="text-sm text-white">{t.description || cat?.name || 'Sin categoría'}</p>
                        <p className="text-xs text-gray-500">{format(new Date(t.date), 'dd MMM')}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-medium ${t.type === 'income' ? 'text-neonGreen' : 'text-neonMagenta'}`}>
                      {formatCurrency(t.type === 'income' ? Number(t.amount) : -Number(t.amount), currency)}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showBalanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowBalanceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="balance-modal-title"
              className="glass rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="balance-modal-title" className="text-xl font-bold text-white mb-4">
                Configurar balance
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Ingresa el dinero que tienes actualmente, sin contar las transacciones del mes.
              </p>
              <label htmlFor="initial-balance" className="sr-only">
                Balance inicial
              </label>
              <input
                id="initial-balance"
                ref={balanceInputRef}
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white text-2xl text-center focus:outline-none focus:border-neonCyan mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBalanceModal(false)}
                  className="flex-1 py-3 rounded-lg bg-white/10 text-white font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveBalance}
                  disabled={saving || !newBalance}
                  className="flex-1 py-3 rounded-lg bg-neonCyan text-background font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neonCyan"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navigation />
    </div>
  )
}