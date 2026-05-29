'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import { UserBadge } from '@/components/UserBadge'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ErrorBanner } from '@/components/ErrorBanner'
import { PageShell } from '@/components/PageShell'
import { useFinanceData } from '@/hooks/useFinanceData'
import { saveInitialBalance } from '@/lib/finance-mutations'
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getCategoryBreakdown,
  getTotals,
} from '@/lib/finance'

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

const monthRange = {
  from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
}

export default function DashboardPage() {
  const {
    user,
    transactions,
    transactionTotals,
    settings,
    categoryById,
    totalPotsBalance,
    potsWithBalances,
    loading,
    error,
    refresh,
    supabase,
  } = useFinanceData({
    transactions: monthRange,
    includeTransactionTotals: true,
  })

  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [newBalance, setNewBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const balanceInputRef = useRef<HTMLInputElement>(null)

  const [alignWithBank, setAlignWithBank] = useState(true)

  const retencionesCategory = useMemo(() => {
    return Array.from(categoryById.values()).find(
      (c) => c.name === 'Retenciones' && c.type === 'expense'
    )
  }, [categoryById])

  const totalHoldsBalance = useMemo(() => {
    if (!retencionesCategory) return 0
    return transactions
      .filter((t) => t.category_id === retencionesCategory.id && t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [transactions, retencionesCategory])

  const displayTransactions = useMemo(() => {
    if (!alignWithBank) return transactions

    return transactions.filter((t) => {
      if (t.type === 'income') {
        const isSelfTransfer =
          t.description.toLowerCase().includes('(ivan)') || t.description.toLowerCase() === 'ivan'
        const isRefund =
          t.category_id && categoryById.get(t.category_id)?.name === 'Devoluciones'
        return !isSelfTransfer && !isRefund
      } else {
        const isSelfTransfer =
          t.description.toLowerCase().includes('cuenta compartida') ||
          t.description.toLowerCase().includes('(ivan)')
        const isHold = retencionesCategory && t.category_id === retencionesCategory.id
        return !isSelfTransfer && !isHold
      }
    })
  }, [transactions, alignWithBank, categoryById, retencionesCategory])

  const { income, expense } = useMemo(() => {
    const raw = getTotals(displayTransactions)
    if (!alignWithBank) return raw

    // For bank aligned expense, subtract the refunds (Devoluciones category)
    const totalRefunds = transactions
      .filter((t) => t.type === 'income' && categoryById.get(t.category_id)?.name === 'Devoluciones')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const alignedExpense = Math.max(0, raw.expense - totalRefunds)
    return { income: raw.income, expense: alignedExpense }
  }, [displayTransactions, alignWithBank, transactions, categoryById])

  const currency = settings?.currency || DEFAULT_CURRENCY
  const initialBalance = settings?.initial_balance || 0
  const accountBalance = initialBalance + transactionTotals.balance

  const regularPots = useMemo(() => {
    return potsWithBalances?.filter((p) => p.name !== 'Retenciones') || []
  }, [potsWithBalances])

  const totalRegularPotsBalance = useMemo(() => {
    return regularPots.reduce((sum, p) => sum + p.balance, 0)
  }, [regularPots])

  const availableBalance = accountBalance - totalRegularPotsBalance
  const totalWorth = availableBalance + totalRegularPotsBalance + totalHoldsBalance

  const expenseByCategory = useMemo(
    () => getCategoryBreakdown(displayTransactions, categoryById, 'expense'),
    [categoryById, displayTransactions]
  )
  const incomeByCategory = useMemo(
    () => getCategoryBreakdown(displayTransactions, categoryById, 'income'),
    [categoryById, displayTransactions]
  )

  const saveBalance = async () => {
    if (!user || !newBalance) return

    setSaving(true)
    setSaveError(null)

    const balance = parseFloat(newBalance.replace(',', '.'))
    if (!Number.isFinite(balance)) {
      setSaveError('Ingresa un balance válido.')
      setSaving(false)
      return
    }

    const { error: saveResultError } = await saveInitialBalance(
      supabase,
      user.id,
      settings,
      balance
    )

    if (saveResultError) {
      setSaveError(saveResultError)
      setSaving(false)
      return
    }

    await refresh()
    setShowBalanceModal(false)
    setNewBalance('')
    setSaving(false)
  }

  const primaryPot = potsWithBalances?.find(p => p.name !== 'Retenciones') || potsWithBalances?.[0]

  useEffect(() => {
    if (showBalanceModal) {
      balanceInputRef.current?.focus()
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBalanceModal(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showBalanceModal])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || loading) {
    return <LoadingScreen message="Cargando tu resumen..." />
  }

  return (
    <PageShell className="mx-auto max-w-lg space-y-6 p-4 md:max-w-3xl lg:max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6 text-center"
      >
        <h1 className="mb-1 text-2xl font-bold text-white">MiFinanza</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'MMMM yyyy', { locale: es })}</p>
      </motion.div>

      <UserBadge />

      <motion.button
        onClick={() => {
          setNewBalance(String(initialBalance))
          setShowBalanceModal(true)
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass w-full rounded-2xl p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neonCyan"
      >
        <p className="mb-1 text-sm text-gray-400">Saldo disponible</p>
        <p className={`text-4xl font-bold ${availableBalance >= 0 ? 'text-neonGreen' : 'text-neonMagenta'}`}>
          {formatCurrency(availableBalance, currency)}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Patrimonio total con apartados: {formatCurrency(totalWorth, currency)}
        </p>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="flex items-center justify-between glass rounded-2xl p-4"
      >
        <div>
          <h4 className="text-sm font-semibold text-white">Estadísticas bancarias</h4>
          <p className="text-xs text-gray-500">Alinear ingresos y gastos con el banco (excluir transferencias propias y reembolsos)</p>
        </div>
        <button
          type="button"
          onClick={() => setAlignWithBank(!alignWithBank)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neonCyan focus:ring-offset-2 focus:ring-offset-background ${
            alignWithBank ? 'bg-neonCyan' : 'bg-white/10'
          }`}
          role="switch"
          aria-checked={alignWithBank}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
              alignWithBank ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </motion.div>

      {primaryPot && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-5 space-y-1"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: primaryPot.color_code }}
            />
            <p className="text-sm font-semibold text-white">{primaryPot.name}</p>
          </div>
          <p className="text-2xl font-bold text-neonCyan pl-5">
            {formatCurrency(primaryPot.balance, currency)}
          </p>
        </motion.div>
      )}

      {error && <ErrorBanner message={error} onRetry={refresh} />}
      {saveError && <ErrorBanner message={saveError} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        <StatCard label="Ingresos" value={formatCurrency(income, currency)} tone="green" delay={0.2} />
        <StatCard label="Gastos" value={formatCurrency(expense, currency)} tone="magenta" delay={0.2} />
        <StatCard label="Apartado" value={formatCurrency(totalRegularPotsBalance, currency)} tone="cyan" delay={0.2} />
        <StatCard label="Retenciones" value={formatCurrency(totalHoldsBalance, currency)} tone="magenta" delay={0.2} />
        <div className="col-span-2 sm:col-span-1 md:col-span-1">
          <StatCard label="Saldo total" value={formatCurrency(totalWorth, currency)} tone="white" delay={0.2} className="w-full" />
        </div>
      </div>

      {initialBalance > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-4"
        >
          <p className="mb-1 text-sm text-gray-400">Balance Inicial</p>
          <p className="text-xl font-semibold text-neonCyan">
            {formatCurrency(initialBalance, currency)}
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="Ingresos por Categoría"
          data={incomeByCategory}
          currency={currency}
          emptyText="Aún no hay ingresos por categoría este mes."
          delay={0.3}
        />
        <ChartCard
          title="Gastos por Categoría"
          data={expenseByCategory}
          currency={currency}
          emptyText="Aún no hay gastos por categoría este mes."
          delay={0.35}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-4"
      >
        <h3 className="mb-3 text-sm text-gray-400">Últimos Movimientos</h3>
        {transactions.length === 0 ? (
          <p className="py-4 text-center text-gray-500">Sin movimientos este mes. Añade uno para empezar.</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map((transaction, index) => {
              const category = categoryById.get(transaction.category_id)
              return (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  className="flex items-center justify-between border-b border-white/5 py-2 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: category?.color_code || '#666' }}
                    />
                    <div>
                      <p className="text-sm text-white">
                        {transaction.description || category?.name || 'Sin categoría'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(transaction.date), 'dd MMM')}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      transaction.type === 'income' ? 'text-neonGreen' : 'text-neonMagenta'
                    }`}
                  >
                    {formatCurrency(
                      transaction.type === 'income'
                        ? Number(transaction.amount)
                        : -Number(transaction.amount),
                      currency
                    )}
                  </p>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showBalanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowBalanceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="balance-modal-title"
              className="glass w-full max-w-sm rounded-2xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="balance-modal-title" className="mb-4 text-xl font-bold text-white">
                Configurar balance
              </h3>
              <p className="mb-4 text-sm text-gray-400">
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
                onChange={(event) => setNewBalance(event.target.value)}
                placeholder="0.00"
                className="mb-4 w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-center text-2xl text-white focus:border-neonCyan focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  className="flex-1 rounded-lg bg-white/10 py-3 font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveBalance}
                  disabled={saving || !newBalance}
                  className="flex-1 rounded-lg bg-neonCyan py-3 font-semibold text-background disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neonCyan"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  )
}

function StatCard({
  label,
  value,
  tone,
  delay,
  className,
}: {
  label: string
  value: string
  tone: 'green' | 'magenta' | 'cyan' | 'white'
  delay: number
  className?: string
}) {
  const toneClass = {
    green: 'text-neonGreen',
    magenta: 'text-neonMagenta',
    cyan: 'text-neonCyan',
    white: 'text-white',
  }[tone]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`glass rounded-2xl p-4 ${className || ''}`}
    >
      <p className="mb-1 text-sm text-gray-400">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </motion.div>
  )
}

function ChartCard({
  title,
  data,
  currency,
  emptyText,
  delay,
}: {
  title: string
  data: { id: string; name: string; value: number; color: string }[]
  currency: string
  emptyText: string
  delay: number
}) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-2xl p-4 text-center text-xs text-gray-500 sm:text-sm">
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl p-4"
    >
      <h3 className="mb-3 text-xs text-gray-400 sm:text-sm">{title}</h3>
      <ExpensePieChart data={data} currency={currency} />
      <div className="mt-3 flex flex-wrap gap-2">
        {data.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-gray-400">{item.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
