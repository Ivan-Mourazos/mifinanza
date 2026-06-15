'use client'

import { useEffect, FormEvent, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { UserBadge } from '@/components/UserBadge'
import { ErrorBanner } from '@/components/ErrorBanner'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageShell } from '@/components/PageShell'
import { useFinanceData } from '@/hooks/useFinanceData'
import { Transaction } from '@/lib/types'
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getCategoryBreakdown,
  getTotals,
} from '@/lib/finance'

const initialFromDate = format(startOfMonth(new Date()), 'yyyy-MM-dd')
const initialToDate = format(endOfMonth(new Date()), 'yyyy-MM-dd')

export default function AnalysisPage() {
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [range, setRange] = useState({ from: initialFromDate, to: initialToDate })

  const { transactions, settings, categoryById, loading, error, refreshTransactions } =
    useFinanceData({
      transactions: range,
    })

  const totals = useMemo(() => getTotals(transactions), [transactions])
  const expenseBreakdown = useMemo(
    () => getCategoryBreakdown(transactions, categoryById, 'expense'),
    [categoryById, transactions]
  )
  const incomeBreakdown = useMemo(
    () => getCategoryBreakdown(transactions, categoryById, 'income'),
    [categoryById, transactions]
  )
  const currency = settings?.currency || DEFAULT_CURRENCY
  const expenseRate = totals.income > 0 ? Math.round((totals.expense / totals.income) * 100) : 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!fromDate || !toDate || fromDate > toDate) return

    setRange({ from: fromDate, to: toDate })
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || (loading && transactions.length === 0)) {
    return <LoadingScreen message="Cargando análisis..." />
  }

  return (
    <PageShell className="mx-auto max-w-lg space-y-4 p-4 md:max-w-4xl">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6"
      >
        <p className="text-xs uppercase tracking-[0.25em] text-neonCyan">Análisis</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Ingresos y gastos</h1>
        <p className="mt-2 text-sm text-gray-500">
          Elige un periodo y compara cómo entra y sale tu dinero.
        </p>
      </motion.header>

      <UserBadge />

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="from-date" className="mb-2 block text-sm text-gray-300">
              Desde
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:border-neonCyan/50 focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="to-date" className="mb-2 block text-sm text-gray-300">
              Hasta
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:border-neonCyan/50 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-neonCyan px-5 py-3 font-semibold text-background shadow-cyan disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Analizar'}
          </button>
        </div>
      </form>

      {error && <ErrorBanner message={error} onRetry={refreshTransactions} />}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-sm text-gray-400">Ingresos del periodo</p>
          <p className="mt-2 text-2xl font-bold text-neonGreen">
            {formatCurrency(totals.income, currency)}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-sm text-gray-400">Gastos del periodo</p>
          <p className="mt-2 text-2xl font-bold text-neonMagenta">
            {formatCurrency(totals.expense, currency)}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-sm text-gray-400">Neto del periodo</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              totals.balance >= 0 ? 'text-neonGreen' : 'text-neonMagenta'
            }`}
          >
            {formatCurrency(totals.balance, currency)}
          </p>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Lectura rápida</h2>
            <p className="text-sm text-gray-500">Resumen simple del periodo elegido.</p>
          </div>
          <p className="text-3xl font-bold text-neonCyan">{expenseRate}%</p>
        </div>
        <p className="mt-3 text-sm text-gray-400">
          Gastaste el {expenseRate}% de tus ingresos del periodo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BreakdownCard
          title="Gastos por categoría"
          items={expenseBreakdown}
          transactions={transactions}
          currency={currency}
          emptyText="No hay gastos en este periodo."
        />
        <BreakdownCard
          title="Ingresos por categoría"
          items={incomeBreakdown}
          transactions={transactions}
          currency={currency}
          emptyText="No hay ingresos en este periodo."
        />
      </section>
    </PageShell>
  )
}

interface BreakdownCardProps {
  title: string
  items: { id: string; name: string; value: number; color: string }[]
  transactions: Transaction[]
  currency: string
  emptyText: string
}

function BreakdownCard({ title, items, transactions, currency, emptyText }: BreakdownCardProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => {
            const width = maxValue > 0 ? `${Math.max((item.value / maxValue) * 100, 8)}%` : '8%'
            const isExpanded = expandedCategoryId === item.id
            
            // Filter transactions of this category
            const categoryTransactions = transactions
              .filter((t) => t.category_id === item.id)
              .sort((a, b) => b.date.localeCompare(a.date))

            return (
              <div key={item.id} className="group">
                <button
                  type="button"
                  onClick={() => setExpandedCategoryId(isExpanded ? null : item.id)}
                  className="mb-2 flex w-full items-center justify-between gap-3 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-neonCyan rounded-lg py-0.5 text-left"
                >
                  <span className="flex items-center gap-2 text-gray-300 group-hover:text-white transition-colors">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium truncate">{item.name}</span>
                    <span className="text-[10px] text-gray-500 shrink-0 font-normal">
                      ({categoryTransactions.length} {categoryTransactions.length === 1 ? 'mov.' : 'movs.'})
                    </span>
                  </span>
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    {formatCurrency(item.value, currency)}
                    <span className={`text-[10px] text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-neonCyan' : ''}`}>
                      ▶
                    </span>
                  </span>
                </button>
                <div 
                  onClick={() => setExpandedCategoryId(isExpanded ? null : item.id)}
                  className="h-2 overflow-hidden rounded-full bg-white/10 cursor-pointer"
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width, backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 pl-3 space-y-1.5 overflow-hidden border-l border-white/5 ml-1.5"
                    >
                      {categoryTransactions.length === 0 ? (
                        <p className="text-xs text-gray-500 py-1">Sin movimientos.</p>
                      ) : (
                        categoryTransactions.map((t) => (
                          <div
                            key={t.id}
                            className="pl-3 pr-2 py-1.5 flex items-center justify-between text-xs hover:bg-white/[0.02] transition-colors rounded-lg border-b border-white/[0.02] last:border-b-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-gray-300 truncate font-medium">
                                {t.description || item.name}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {format(new Date(t.date), 'dd MMM yyyy', { locale: es })}
                              </p>
                            </div>
                            <p className="font-semibold text-white pl-2 shrink-0">
                              {formatCurrency(Number(t.amount), currency)}
                            </p>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
