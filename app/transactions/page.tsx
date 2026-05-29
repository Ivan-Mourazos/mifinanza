'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { UserBadge } from '@/components/UserBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorBanner } from '@/components/ErrorBanner'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageShell } from '@/components/PageShell'
import { MovementFormType, TransactionForm, DescriptionSuggestion } from '@/components/TransactionForm'
import { useFinanceData } from '@/hooks/useFinanceData'
import { DEFAULT_CURRENCY, formatCurrency, getTotals } from '@/lib/finance'
import {
  deleteTransaction,
  deletePotMovement,
  savePotMovement,
  saveTransaction,
  saveCategory,
} from '@/lib/finance-mutations'
import { fetchDescriptionSuggestions } from '@/lib/finance-api'
import { SavingPotMovement, SavingPotMovementType, Transaction } from '@/lib/types'
import { BankImportModal } from '@/components/BankImportModal'

export default function TransactionsPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const monthRange = useMemo(
    () => ({
      from: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
      to: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
    }),
    [selectedMonth]
  )

  const {
    user,
    categories,
    transactions,
    settings,
    potsWithBalances,
    potMovements,
    totalPotsBalance,
    categoryById,
    loading,
    error,
    refresh,
    supabase,
  } = useFinanceData({ transactions: monthRange })

  const regularPots = useMemo(() => {
    return potsWithBalances?.filter((p) => p.name !== 'Retenciones') || []
  }, [potsWithBalances])

  const totalRegularPotsBalance = useMemo(() => {
    return regularPots.reduce((sum, p) => sum + p.balance, 0)
  }, [regularPots])

  const filteredCategoriesForForm = useMemo(() => {
    return categories.filter((c) => c.name !== 'Retenciones')
  }, [categories])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [type, setType] = useState<MovementFormType>('expense')
  const [potAction, setPotAction] = useState<SavingPotMovementType>('deposit')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletePotTarget, setDeletePotTarget] = useState<SavingPotMovement | null>(null)
  const [deletingPot, setDeletingPot] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [selectedType, setSelectedType] = useState('all')

  const resetForm = () => {
    setAmount('')
    setDescription('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setType('expense')
    setPotAction('deposit')
    setCategoryId(categories.find((category) => category.type === 'expense')?.id || '')
    setEditingId(null)
    setShowForm(false)
  }

  const changeMovementType = (nextType: MovementFormType) => {
    setType(nextType)

    if (nextType === 'pot') {
      setEditingId(null)
      setCategoryId('')
      return
    }

    setCategoryId(categories.find((category) => category.type === nextType)?.id || '')
  }

  const openNewMovementForm = () => {
    setEditingId(null)
    setType('expense')
    setCategoryId(categories.find((category) => category.type === 'expense')?.id || '')
    setShowForm(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !amount) return

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Ingresa un importe mayor que cero.')
      return
    }

    setSaving(true)
    setFormError(null)

    if (type === 'pot') {
      const defaultPot = regularPots[0] || potsWithBalances[0]
      if (!defaultPot) {
        setFormError('No se encontró el apartado.')
        setSaving(false)
        return
      }

      if (potAction === 'withdrawal' && parsedAmount > defaultPot.balance) {
        setFormError('No puedes recuperar más dinero del que tienes apartado.')
        setSaving(false)
        return
      }

      const { error: potError } = await savePotMovement(supabase, {
        userId: user.id,
        potId: defaultPot.id,
        amount: parsedAmount,
        type: potAction,
        note: description,
      })

      if (potError) {
        setFormError(potError)
        setSaving(false)
        return
      }

      await refresh()
      resetForm()
      setSaving(false)
      return
    }

    if (!categoryId) {
      setFormError('Selecciona una categoría.')
      setSaving(false)
      return
    }

    const result = await saveTransaction(supabase, {
      id: editingId,
      userId: user.id,
      amount: parsedAmount,
      description,
      date,
      type,
      categoryId,
    })

    if (result.error) {
      setFormError(result.error)
      setSaving(false)
      return
    }

    await refresh()
    resetForm()
    setSaving(false)
  }

  const handleEdit = (transaction: Transaction) => {
    setAmount(String(transaction.amount))
    setDescription(transaction.description)
    setDate(transaction.date)
    setType(transaction.type)
    setCategoryId(transaction.category_id)
    setEditingId(transaction.id)
    setShowForm(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setFormError(null)

    const { error: deleteError } = await deleteTransaction(supabase, deleteTarget.id)
    if (deleteError) {
      setFormError(deleteError)
      setDeleting(false)
      return
    }

    await refresh()
    setDeleteTarget(null)
    setDeleting(false)
  }

  const confirmDeletePotMovement = async () => {
    if (!deletePotTarget) return
    setDeletingPot(true)
    setFormError(null)
    const { error: deleteError } = await deletePotMovement(supabase, deletePotTarget.id)
    if (deleteError) {
      setFormError(deleteError)
      setDeletingPot(false)
      return
    }
    await refresh()
    setDeletePotTarget(null)
    setDeletingPot(false)
  }

  const handleCreateCategory = async (name: string, colorCode: string) => {
    if (!user) return { data: null, error: 'Usuario no autenticado.' }

    const result = await saveCategory(supabase, {
      userId: user.id,
      name,
      type: type === 'pot' ? 'expense' : type,
      colorCode,
    })

    if (!result.error) {
      await refresh()
    }

    return result
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchSearch =
        !search ||
        (transaction.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (categoryById.get(transaction.category_id)?.name || '')
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchCategory =
        selectedCategoryId === 'all' || transaction.category_id === selectedCategoryId

      const matchType =
        selectedType === 'all' || transaction.type === selectedType

      return matchSearch && matchCategory && matchType
    })
  }, [transactions, search, selectedCategoryId, selectedType, categoryById])

  const totals = useMemo(() => getTotals(filteredTransactions), [filteredTransactions])
  const currency = settings?.currency || DEFAULT_CURRENCY
  const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: es })

  // Pot movements filtered to the selected month
  const primaryPot = regularPots[0] || potsWithBalances[0]
  const filteredPotMovements = useMemo(() => {
    if (!potMovements) return []
    return potMovements.filter((pm) => {
      const d = new Date(pm.created_at)
      const inMonth =
        d >= new Date(monthRange.from) && d <= new Date(monthRange.to + 'T23:59:59')
      const matchSearch =
        !search || (pm.note || '').toLowerCase().includes(search.toLowerCase()) ||
        (primaryPot?.name || '').toLowerCase().includes(search.toLowerCase())
      const matchType = selectedType === 'all' || selectedType === 'pot'
      return inMonth && matchSearch && matchType
    })
  }, [potMovements, monthRange, search, selectedType, primaryPot])

  // Unified list: transactions + pot movements sorted by date desc
  type ListItem =
    | { kind: 'tx'; data: Transaction }
    | { kind: 'pot'; data: SavingPotMovement }

  const unifiedList = useMemo<ListItem[]>(() => {
    const txItems: ListItem[] = filteredTransactions.map((t) => ({ kind: 'tx', data: t }))
    const potItems: ListItem[] = filteredPotMovements.map((pm) => ({ kind: 'pot', data: pm }))
    return [...txItems, ...potItems].sort((a, b) => {
      const dateA = a.kind === 'tx' ? a.data.date : a.data.created_at.slice(0, 10)
      const dateB = b.kind === 'tx' ? b.data.date : b.data.created_at.slice(0, 10)
      return dateB.localeCompare(dateA)
    })
  }, [filteredTransactions, filteredPotMovements])

  // All-time description suggestions (not limited to the current month)
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<DescriptionSuggestion[]>([])

  const refreshDescriptionSuggestions = useCallback(async () => {
    if (!user) return
    const { data } = await fetchDescriptionSuggestions(supabase, user.id)
    // Deduplicate by description, keeping the first (most recent) occurrence
    const seen = new Set<string>()
    const unique: DescriptionSuggestion[] = []
    for (const row of data) {
      if (!row.description || seen.has(row.description)) continue
      seen.add(row.description)
      unique.push({
        description: row.description,
        categoryId: row.category_id,
        type: row.type as 'income' | 'expense',
      })
    }
    setDescriptionSuggestions(unique)
  }, [supabase, user])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch all-time description suggestions once user is ready
  useEffect(() => {
    refreshDescriptionSuggestions()
  }, [refreshDescriptionSuggestions])

  if (!mounted || loading) {
    return <LoadingScreen message="Cargando movimientos..." />
  }

  return (
    <PageShell className="mx-auto max-w-lg space-y-4 p-4 md:max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6 text-center"
      >
        <h1 className="text-2xl font-bold text-white">Movimientos</h1>
      </motion.div>

      <UserBadge />

      <section className="glass rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Resumen</p>
            <h2 className="text-lg font-semibold capitalize text-white">{monthLabel}</h2>
          </div>
          <p
            className={`text-right text-2xl font-bold ${
              totals.balance >= 0 ? 'text-neonGreen' : 'text-neonMagenta'
            }`}
          >
            {formatCurrency(totals.balance, currency)}
          </p>
        </div>
        <div className="mb-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedMonth((current) => addMonths(current, -1))}
              className="rounded-xl bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white hover:bg-white/[0.08]"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <select
              value={selectedMonth.getMonth()}
              onChange={(e) => {
                const newMonth = parseInt(e.target.value)
                setSelectedMonth((current) => {
                  const next = new Date(current)
                  next.setMonth(newMonth)
                  return startOfMonth(next)
                })
              }}
              className="flex-1 sm:flex-initial rounded-xl border border-white/10 bg-surface px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-neonCyan/50"
            >
              {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <select
              value={selectedMonth.getFullYear()}
              onChange={(e) => {
                const newYear = parseInt(e.target.value)
                setSelectedMonth((current) => {
                  const next = new Date(current)
                  next.setFullYear(newYear)
                  return startOfMonth(next)
                })
              }}
              className="rounded-xl border border-white/10 bg-surface px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-neonCyan/50"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedMonth((current) => addMonths(current, 1))}
              className="rounded-xl bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white hover:bg-white/[0.08]"
              aria-label="Mes siguiente"
            >
              →
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(startOfMonth(new Date()))}
            className="w-full sm:w-auto rounded-xl bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.08]"
          >
            Este mes
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">Ingresos visibles</p>
            <p className="mt-1 font-semibold text-neonGreen">
              {formatCurrency(totals.income, currency)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">Gastos visibles</p>
            <p className="mt-1 font-semibold text-neonMagenta">
              {formatCurrency(totals.expense, currency)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">Apartado</p>
            <p className="mt-1 font-semibold text-neonCyan">
              {formatCurrency(totalRegularPotsBalance, currency)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Basado en los movimientos de {monthLabel}. No incluye dinero separado en apartados.
        </p>
      </section>

      {/* Buscador y Filtros Avanzados */}
      <section className="glass rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Buscador */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar movimiento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface pl-10 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-neonCyan/50 focus:outline-none"
            />
            <span className="absolute left-3.5 top-3 text-gray-500 text-sm">🔍</span>
          </div>

          {/* Filtro por Categoría */}
          <div>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm text-white focus:border-neonCyan/50 focus:outline-none"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'income' ? 'Ingreso' : 'Gasto'})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm text-white focus:border-neonCyan/50 focus:outline-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
          </div>
        </div>
        {(search || selectedCategoryId !== 'all' || selectedType !== 'all') && (
          <div className="flex justify-between items-center pt-1 text-xs">
            <span className="text-gray-400">
              Mostrando {filteredTransactions.length} de {transactions.length} movimientos
            </span>
            <button
              onClick={() => {
                setSearch('')
                setSelectedCategoryId('all')
                setSelectedType('all')
              }}
              className="text-neonCyan hover:underline font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass overflow-hidden rounded-2xl p-4"
          >
            <TransactionForm
              amount={amount}
              description={description}
              date={date}
              type={type}
              potAction={potAction}
              categoryId={categoryId}
              categories={filteredCategoriesForForm}
              saving={saving}
              editing={Boolean(editingId)}
              descriptionSuggestions={descriptionSuggestions}
              onAmountChange={setAmount}
              onDescriptionChange={setDescription}
              onDateChange={setDate}
              onTypeChange={changeMovementType}
              onPotActionChange={setPotAction}
              onCategoryChange={setCategoryId}
              onCancel={resetForm}
              onSubmit={handleSubmit}
              onCreateCategory={handleCreateCategory}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showForm && (
        <div className="flex gap-3">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={openNewMovementForm}
            className="flex-1 rounded-2xl bg-neonCyan py-4 text-base font-semibold text-background shadow-cyan"
          >
            + Nuevo Movimiento
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowImportModal(true)}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white hover:bg-white/10"
          >
            ⤓ Importar Banco
          </motion.button>
        </div>
      )}

      {(error || formError) && (
        <ErrorBanner message={formError || error || ''} onRetry={refresh} />
      )}



      <div className="space-y-2">
        {unifiedList.map((item, index) => {
          if (item.kind === 'pot') {
            const pm = item.data
            const pot = primaryPot
            const isDeposit = pm.type === 'deposit'
            return (
              <motion.div
                key={`pot-${pm.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.015, 0.15) }}
                className="glass flex items-center justify-between rounded-xl p-4 border border-neonCyan/10"
              >
                <div className="flex flex-1 items-center gap-3">
                  <span className="text-base" aria-hidden>🪙</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-white">
                        {pm.note || pot?.name || 'Apartado'}
                      </p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        isDeposit ? 'bg-neonCyan/15 text-neonCyan' : 'bg-neonMagenta/15 text-neonMagenta'
                      }`}>
                        {isDeposit ? '↑ Apartado' : '↓ Recuperado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {format(new Date(pm.created_at), 'dd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${
                    isDeposit ? 'text-neonCyan' : 'text-neonMagenta'
                  }`}>
                    {isDeposit ? '' : '-'}{formatCurrency(Number(pm.amount), currency)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeletePotTarget(pm)}
                    aria-label={`Borrar movimiento de apartado`}
                    className="p-2 text-gray-500 hover:text-neonMagenta"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )
          }

          const transaction = item.data
          const category = categoryById.get(transaction.category_id)
          return (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.015, 0.15) }}
              className="glass flex items-center justify-between rounded-xl p-4"
            >
              <div className="flex flex-1 items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: category?.color_code || '#666' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-white">
                    {transaction.description || category?.name || 'Sin categoría'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(transaction.date), 'dd MMM yyyy', { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`font-medium ${
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
                <button
                  type="button"
                  onClick={() => handleEdit(transaction)}
                  aria-label={`Editar movimiento ${transaction.description || category?.name || 'sin categoría'}`}
                  className="p-2 text-gray-500 hover:text-neonCyan"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(transaction)}
                  aria-label={`Borrar movimiento ${transaction.description || category?.name || 'sin categoría'}`}
                  className="p-2 text-gray-500 hover:text-neonMagenta"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )
        })}

        {unifiedList.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            Aún no hay movimientos. Crea el primero para ver tu resumen.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Borrar movimiento"
        description="Esta acción quitará el movimiento de tus cálculos y no se puede deshacer."
        confirmLabel="Borrar"
        loading={deleting}
        destructive
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={Boolean(deletePotTarget)}
        title="Borrar movimiento de apartado"
        description="Esto ajustará el saldo del apartado. No se puede deshacer."
        confirmLabel="Borrar"
        loading={deletingPot}
        destructive
        onCancel={() => {
          if (!deletingPot) setDeletePotTarget(null)
        }}
        onConfirm={confirmDeletePotMovement}
      />

      <BankImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={refresh}
        categories={categories}
        supabase={supabase}
        userId={user?.id || ''}
      />
    </PageShell>
  )
}
