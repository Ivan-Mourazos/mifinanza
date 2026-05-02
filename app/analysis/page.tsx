'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/Navigation'
import { UserBadge } from '@/components/UserBadge'
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getCategoryBreakdown,
  getTotals,
} from '@/lib/finance'
import { Category, Transaction, UserSettings } from '@/lib/types'

const initialFromDate = format(startOfMonth(new Date()), 'yyyy-MM-dd')
const initialToDate = format(endOfMonth(new Date()), 'yyyy-MM-dd')

export default function AnalysisPage() {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async (rangeFrom: string, rangeTo: string) => {
    setError(null)
    setLoading(true)

    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) {
      setError('Elige un periodo válido.')
      setLoading(false)
      return
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) {
      setError('No se pudo comprobar tu sesión.')
      setLoading(false)
      return
    }

    const currentUser = userData.user
    if (!currentUser) {
      router.replace('/auth')
      setLoading(false)
      return
    }

    setUser(currentUser)

    const [transactionsRes, categoriesRes, settingsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('date', rangeFrom)
        .lte('date', rangeTo)
        .order('date', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name'),
      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .single(),
    ])

    const settingsError =
      settingsRes.error && settingsRes.error.code !== 'PGRST116' ? settingsRes.error : null
    const requestError = transactionsRes.error || categoriesRes.error || settingsError

    if (requestError) {
      setError('No se pudo cargar el análisis. Intenta de nuevo.')
      setLoading(false)
      return
    }

    setTransactions(transactionsRes.data || [])
    setCategories(categoriesRes.data || [])
    setSettings(settingsRes.data || null)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    fetchData(initialFromDate, initialToDate)
  }, [fetchData])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
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
    fetchData(fromDate, toDate)
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto max-w-lg p-4 space-y-4 md:max-w-4xl">
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

        <UserBadge user={user} />

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
                className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:outline-none focus:border-neonCyan/50"
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
                className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:outline-none focus:border-neonCyan/50"
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

        {error && (
          <div className="rounded-2xl border border-neonMagenta/30 bg-neonMagenta/10 p-4 text-sm text-neonMagenta">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => fetchData(fromDate, toDate)}
              className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              Reintentar
            </button>
          </div>
        )}

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
            currency={currency}
            emptyText="No hay gastos en este periodo."
          />
          <BreakdownCard
            title="Ingresos por categoría"
            items={incomeBreakdown}
            currency={currency}
            emptyText="No hay ingresos en este periodo."
          />
        </section>
      </div>

      <Navigation />
    </div>
  )
}

interface BreakdownCardProps {
  title: string
  items: { id: string; name: string; value: number; color: string }[]
  currency: string
  emptyText: string
}

function BreakdownCard({ title, items, currency, emptyText }: BreakdownCardProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => {
            const width = maxValue > 0 ? `${Math.max((item.value / maxValue) * 100, 8)}%` : '8%'

            return (
              <div key={item.id}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-gray-300">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-medium text-white">
                    {formatCurrency(item.value, currency)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-neonCyan"
                    style={{ width }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
