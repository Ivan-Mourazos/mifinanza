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
import { saveInitialBalance, saveSavingPot } from '@/lib/finance-mutations'
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

  const [showPotModal, setShowPotModal] = useState(false)
  const [potName, setPotName] = useState('')
  const [potTarget, setPotTarget] = useState('')
  const [potColor, setPotColor] = useState('')
  const [savingPot, setSavingPot] = useState(false)
  const [potError, setPotError] = useState<string | null>(null)

  const { income, expense } = useMemo(
    () => getTotals(transactions),
    [transactions]
  )
  const currency = settings?.currency || DEFAULT_CURRENCY
  const initialBalance = settings?.initial_balance || 0
  const accountBalance = initialBalance + transactionTotals.balance
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

  const primaryPot = potsWithBalances?.[0]

  const handleSavePot = async () => {
    if (!user || !primaryPot) return

    setSavingPot(true)
    setPotError(null)

    const targetAmount = parseFloat(potTarget.replace(',', '.'))
    if (isNaN(targetAmount) || targetAmount < 0) {
      setPotError('Ingresa un objetivo válido.')
      setSavingPot(false)
      return
    }

    const { error: saveError } = await saveSavingPot(supabase, {
      id: primaryPot.id,
      userId: user.id,
      name: potName.trim() || 'Mi Apartado',
      targetAmount,
      colorCode: potColor || '#00D9FF',
    })

    if (saveError) {
      setPotError(saveError)
      setSavingPot(false)
      return
    }

    await refresh()
    setShowPotModal(false)
    setSavingPot(false)
  }

  useEffect(() => {
    if (showBalanceModal) {
      balanceInputRef.current?.focus()
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBalanceModal(false)
        setShowPotModal(false)
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

      {primaryPot && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: primaryPot.color_code }}
              />
              <p className="text-sm font-semibold text-white">{primaryPot.name}</p>
            </div>
            <button
              onClick={() => {
                setPotName(primaryPot.name)
                setPotTarget(String(primaryPot.target_amount))
                setPotColor(primaryPot.color_code)
                setPotError(null)
                setShowPotModal(true)
              }}
              className="text-xs text-neonCyan hover:underline"
            >
              Configurar Meta
            </button>
          </div>

          <div className="flex items-end justify-between text-sm">
            <span className="font-bold text-neonCyan">
              {formatCurrency(primaryPot.balance, currency)}
            </span>
            <span className="text-xs text-gray-400">
              objetivo de {formatCurrency(primaryPot.target_amount, currency)} ({Math.round(primaryPot.progress)}%)
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                backgroundColor: primaryPot.color_code,
                width: `${primaryPot.progress}%`,
              }}
            />
          </div>
        </motion.div>
      )}

      {error && <ErrorBanner message={error} onRetry={refresh} />}
      {saveError && <ErrorBanner message={saveError} />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Ingresos" value={formatCurrency(income, currency)} tone="green" delay={0.2} />
        <StatCard label="Gastos" value={formatCurrency(expense, currency)} tone="magenta" delay={0.2} />
        <StatCard label="Apartado" value={formatCurrency(totalPotsBalance, currency)} tone="cyan" delay={0.2} />
        <StatCard label="Saldo total" value={formatCurrency(totalWorth, currency)} tone="white" delay={0.2} />
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

        {showPotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowPotModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              role="dialog"
              aria-modal="true"
              className="glass w-full max-w-sm rounded-2xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="mb-4 text-xl font-bold text-white">Configurar Meta de Ahorro</h3>
              {potError && <p className="mb-3 text-sm text-neonMagenta">{potError}</p>}
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nombre del Apartado</label>
                  <input
                    type="text"
                    value={potName}
                    onChange={(e) => setPotName(e.target.value)}
                    placeholder="Ej. Vacaciones, Coche..."
                    className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-white focus:border-neonCyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Monto Objetivo ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={potTarget}
                    onChange={(e) => setPotTarget(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-white focus:border-neonCyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Color del Apartado</label>
                  <div className="flex gap-2 justify-between">
                    {['#00D9FF', '#00FF88', '#FF2D55', '#A855F7', '#FF9500', '#FFCC00'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPotColor(c)}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          potColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPotModal(false)}
                  className="flex-1 rounded-lg bg-white/10 py-3 font-medium text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePot}
                  disabled={savingPot || !potTarget}
                  className="flex-1 rounded-lg bg-neonCyan py-3 font-semibold text-background disabled:opacity-50"
                >
                  {savingPot ? 'Guardando...' : 'Guardar'}
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
}: {
  label: string
  value: string
  tone: 'green' | 'magenta' | 'cyan' | 'white'
  delay: number
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
      className="glass rounded-2xl p-4"
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
