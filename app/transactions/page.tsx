'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { UserBadge } from '@/components/UserBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorBanner } from '@/components/ErrorBanner'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageShell } from '@/components/PageShell'
import { MovementFormType, TransactionForm } from '@/components/TransactionForm'
import { useFinanceData } from '@/hooks/useFinanceData'
import { DEFAULT_CURRENCY, formatCurrency, getTotals } from '@/lib/finance'
import {
  deleteTransaction,
  savePotMovement,
  saveTransaction,
} from '@/lib/finance-mutations'
import { SavingPotMovementType, Transaction } from '@/lib/types'
import { BankImportModal } from '@/components/BankImportModal'

const TRANSACTION_LIMIT = 50
const RECENT_TRANSACTIONS_QUERY = { limit: TRANSACTION_LIMIT }

export default function TransactionsPage() {
  const {
    user,
    categories,
    transactions,
    settings,
    potsWithBalances,
    totalPotsBalance,
    categoryById,
    loading,
    error,
    refresh,
    supabase,
  } = useFinanceData({ transactions: RECENT_TRANSACTIONS_QUERY })

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
  const [showImportModal, setShowImportModal] = useState(false)

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
      const defaultPot = potsWithBalances[0]
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

  const totals = useMemo(() => getTotals(transactions), [transactions])
  const currency = settings?.currency || DEFAULT_CURRENCY

  if (loading) {
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
            <h2 className="text-lg font-semibold text-white">Últimos movimientos</h2>
          </div>
          <p
            className={`text-right text-2xl font-bold ${
              totals.balance >= 0 ? 'text-neonGreen' : 'text-neonMagenta'
            }`}
          >
            {formatCurrency(totals.balance, currency)}
          </p>
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
              {formatCurrency(totalPotsBalance, currency)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Basado en los últimos {TRANSACTION_LIMIT} movimientos cargados. No incluye dinero separado en apartados.
        </p>
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
              categories={categories}
              saving={saving}
              editing={Boolean(editingId)}
              onAmountChange={setAmount}
              onDescriptionChange={setDescription}
              onDateChange={setDate}
              onTypeChange={changeMovementType}
              onPotActionChange={setPotAction}
              onCategoryChange={setCategoryId}
              onCancel={resetForm}
              onSubmit={handleSubmit}
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
        {transactions.map((transaction, index) => {
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

        {transactions.length === 0 && (
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
