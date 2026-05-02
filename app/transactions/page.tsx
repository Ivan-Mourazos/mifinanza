'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Navigation } from '@/components/Navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { UserBadge } from '@/components/UserBadge'
import {
  DEFAULT_CURRENCY,
  defaultCategories,
  formatCurrency,
  getPotsWithBalances,
  getTotalPotsBalance,
  getTotals,
} from '@/lib/finance'
import { Category, SavingPot, SavingPotMovement, SavingPotMovementType, Transaction } from '@/lib/types'

type MovementFormType = 'expense' | 'income' | 'pot'

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pots, setPots] = useState<SavingPot[]>([])
  const [potMovements, setPotMovements] = useState<SavingPotMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [type, setType] = useState<MovementFormType>('expense')
  const [potAction, setPotAction] = useState<SavingPotMovementType>('deposit')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    let categoriesRes = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (categoriesRes.error) {
      setError('No se pudieron cargar las categorías.')
      setLoading(false)
      return
    }

    if (!categoriesRes.data || categoriesRes.data.length === 0) {
      const { error } = await supabase.from('categories').insert(
        defaultCategories.map((cat) => ({
          user_id: user.id,
          ...cat,
        }))
      )

      if (error) {
        setError('No se pudieron crear las categorías iniciales.')
        setLoading(false)
        return
      }

      categoriesRes = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
    }

    setCategories(categoriesRes.data || [])

    const [transactionsRes, potsRes, potMovementsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50),
      supabase
        .from('saving_pots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('saving_pot_movements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (transactionsRes.error) {
      setError('No se pudieron cargar los movimientos.')
      setLoading(false)
      return
    }

    if (potsRes.error || potMovementsRes.error) {
      setError('No se pudieron cargar los apartados. Revisa que el SQL esté ejecutado en Supabase.')
      setLoading(false)
      return
    }

    let loadedPots = potsRes.data || []
    if (loadedPots.length === 0) {
      const { data, error } = await supabase
        .from('saving_pots')
        .insert({
          user_id: user.id,
          name: 'Apartado principal',
          target_amount: 0,
          color_code: '#00D9FF',
        })
        .select('*')
        .single()

      if (error) {
        setError('No se pudo preparar el apartado.')
        setLoading(false)
        return
      }

      loadedPots = data ? [data] : []
    }

    setTransactions(transactionsRes.data || [])
    setPots(loadedPots)
    setPotMovements(potMovementsRes.data || [])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetForm = () => {
    setAmount('')
    setDescription('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setType('expense')
    setPotAction('deposit')
    setCategoryId(categories.find((c) => c.type === 'expense')?.id || '')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount) return

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresa un importe mayor que cero.')
      return
    }

    setSaving(true)
    setError(null)

    if (type === 'pot') {
      const defaultPot = potsWithBalances[0]
      if (!defaultPot) {
        setError('No se encontró el apartado.')
        setSaving(false)
        return
      }

      if (potAction === 'withdrawal' && parsedAmount > defaultPot.balance) {
        setError('No puedes recuperar más dinero del que tienes apartado.')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('saving_pot_movements').insert({
        user_id: user.id,
        pot_id: defaultPot.id,
        amount: parsedAmount,
        type: potAction,
        note: description,
      })

      if (error) {
        setError('No se pudo registrar el movimiento de apartado.')
        setSaving(false)
        return
      }

      await fetchData()
      resetForm()
      setSaving(false)
      return
    }

    if (!categoryId) {
      setError('Selecciona una categoría.')
      setSaving(false)
      return
    }

    const data = {
      user_id: user.id,
      amount: parsedAmount,
      description,
      date,
      type,
      category_id: categoryId,
    }

    const result = editingId
      ? await supabase.from('transactions').update(data).eq('id', editingId)
      : await supabase.from('transactions').insert(data)

    if (result.error) {
      setError('No se pudo guardar el movimiento.')
      setSaving(false)
      return
    }

    await fetchData()
    resetForm()
    setSaving(false)
  }

  const handleEdit = (t: Transaction) => {
    setAmount(String(t.amount))
    setDescription(t.description)
    setDate(t.date)
    setType(t.type)
    setCategoryId(t.category_id)
    setEditingId(t.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('¿Quieres borrar este movimiento?')
    if (!confirmed) return

    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      setError('No se pudo borrar el movimiento.')
      return
    }

    await fetchData()
  }

  useEffect(() => {
    if (categories.length > 0 && type !== 'pot' && !showForm) {
      const defaultCat = categories.find((c) => c.type === type)
      if (defaultCat) setCategoryId(defaultCat.id)
    }
  }, [type, categories, showForm])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const filteredCategories = useMemo(
    () => (type === 'pot' ? [] : categories.filter((c) => c.type === type)),
    [categories, type]
  )

  const totals = useMemo(() => getTotals(transactions), [transactions])
  const potsWithBalances = useMemo(
    () => getPotsWithBalances(pots, potMovements),
    [potMovements, pots]
  )
  const totalPotsBalance = useMemo(
    () => getTotalPotsBalance(potsWithBalances),
    [potsWithBalances]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-neonCyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Cargando movimientos...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto max-w-lg p-4 space-y-4 md:max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <h1 className="text-2xl font-bold text-white">Movimientos</h1>
        </motion.div>

        <UserBadge user={user} />

        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Resumen</p>
              <h2 className="text-lg font-semibold text-white">Últimos movimientos</h2>
            </div>
            <p
              className={`text-right text-2xl font-bold ${
                totals.balance >= 0 ? 'text-neonGreen' : 'text-neonMagenta'
              }`}
            >
              {formatCurrency(totals.balance, DEFAULT_CURRENCY)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xs text-gray-500">Ingresos visibles</p>
              <p className="mt-1 font-semibold text-neonGreen">
                {formatCurrency(totals.income, DEFAULT_CURRENCY)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xs text-gray-500">Gastos visibles</p>
              <p className="mt-1 font-semibold text-neonMagenta">
                {formatCurrency(totals.expense, DEFAULT_CURRENCY)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-xs text-gray-500">Apartado</p>
              <p className="mt-1 font-semibold text-neonCyan">
                {formatCurrency(totalPotsBalance, DEFAULT_CURRENCY)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Basado en los últimos 50 movimientos cargados. No incluye dinero separado en apartados.
          </p>
        </section>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass rounded-2xl p-4 overflow-hidden"
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                      type === 'expense'
                        ? 'bg-neonMagenta text-white'
                        : 'text-gray-400'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                      type === 'income'
                        ? 'bg-neonGreen text-background'
                        : 'text-gray-400'
                    }`}
                  >
                    Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('pot')
                      setEditingId(null)
                    }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                      type === 'pot'
                        ? 'bg-neonCyan text-background'
                        : 'text-gray-400'
                    }`}
                  >
                    Apartado
                  </button>
                </div>

                {type === 'pot' && (
                  <div>
                    <label htmlFor="pot-action" className="mb-2 block text-sm text-gray-300">
                      Acción
                    </label>
                    <select
                      id="pot-action"
                      value={potAction}
                      onChange={(e) => setPotAction(e.target.value as SavingPotMovementType)}
                      className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white focus:outline-none focus:border-neonCyan/50"
                    >
                      <option value="deposit">Apartar dinero</option>
                      <option value="withdrawal">Recuperar dinero</option>
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="transaction-amount" className="mb-2 block text-sm text-gray-300">
                    Importe
                  </label>
                  <input
                    id="transaction-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white text-2xl text-center focus:outline-none focus:border-neonCyan/50"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="transaction-description" className="mb-2 block text-sm text-gray-300">
                    Descripción
                  </label>
                  <input
                    id="transaction-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan/50"
                  />
                </div>

                {type !== 'pot' && (
                  <div>
                  <label htmlFor="transaction-date" className="mb-2 block text-sm text-gray-300">
                    Fecha
                  </label>
                  <input
                    id="transaction-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white focus:outline-none focus:border-neonCyan/50"
                    required
                  />
                  </div>
                )}

                {type !== 'pot' && (
                  <div>
                  <label htmlFor="transaction-category" className="mb-2 block text-sm text-gray-300">
                    Categoría
                  </label>
                  <select
                    id="transaction-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white focus:outline-none focus:border-neonCyan/50"
                    required
                  >
                    <option value="">Seleccionar categoría</option>
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3 rounded-lg bg-white/10 text-white font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-lg bg-neonCyan text-background font-semibold shadow-cyan disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {!showForm && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(true)}
            className="w-full py-4 rounded-2xl bg-neonCyan text-background font-semibold text-lg shadow-cyan"
          >
            + Nuevo Movimiento
          </motion.button>
        )}

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

        <div className="space-y-2">
          {transactions.map((t, i) => {
            const cat = categoryById.get(t.category_id)
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.15) }}
                className="glass rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat?.color_code || '#666' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">
                      {t.description || cat?.name || 'Sin categoría'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(t.date), 'dd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${t.type === 'income' ? 'text-neonGreen' : 'text-neonMagenta'}`}>
                    {formatCurrency(t.type === 'income' ? Number(t.amount) : -Number(t.amount), DEFAULT_CURRENCY)}
                  </p>
                  <button
                    onClick={() => handleEdit(t)}
                    aria-label={`Editar movimiento ${t.description || cat?.name || 'sin categoría'}`}
                    className="p-2 text-gray-500 hover:text-neonCyan"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    aria-label={`Borrar movimiento ${t.description || cat?.name || 'sin categoría'}`}
                    className="p-2 text-gray-500 hover:text-neonMagenta"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )
          })}

          {transactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aún no hay movimientos. Crea el primero para ver tu resumen.
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </div>
  )
}