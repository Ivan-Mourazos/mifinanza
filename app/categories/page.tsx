'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserBadge } from '@/components/UserBadge'
import { CategoryForm } from '@/components/CategoryForm'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorBanner } from '@/components/ErrorBanner'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageShell } from '@/components/PageShell'
import { useFinanceCore } from '@/context/FinanceContext'
import { useSupabase } from '@/components/SupabaseProvider'
import { createClient } from '@/lib/supabase/client'
import { deleteCategory, saveCategory } from '@/lib/finance-mutations'
import { Category, TransactionType } from '@/lib/types'

export default function CategoriesPage() {
  const { user } = useSupabase()
  const { categories, coreLoading, coreError, refreshCore } = useFinanceCore()
  const supabase = useMemo(() => createClient(), [])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [colorCode, setColorCode] = useState('#FF2D55')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  const resetForm = () => {
    setName('')
    setType('expense')
    setColorCode('#FF2D55')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!user || !trimmedName) {
      setError('Escribe un nombre para la categoría.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await saveCategory(supabase, {
      id: editingId,
      userId: user.id,
      name: trimmedName,
      type,
      colorCode,
    })

    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    await refreshCore()
    resetForm()
    setSaving(false)
  }

  const handleEdit = (category: Category) => {
    setName(category.name)
    setType(category.type)
    setColorCode(category.color_code)
    setEditingId(category.id)
    setShowForm(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setError(null)

    const { error: deleteError } = await deleteCategory(supabase, deleteTarget.id)
    if (deleteError) {
      setError(deleteError)
      setDeleting(false)
      return
    }

    await refreshCore()
    setDeleteTarget(null)
    setDeleting(false)
  }

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === 'income'),
    [categories]
  )
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  )

  if (coreLoading) {
    return <LoadingScreen message="Cargando categorías..." />
  }

  return (
    <PageShell className="mx-auto max-w-lg space-y-4 p-4 md:max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6 text-center"
      >
        <h1 className="text-2xl font-bold text-white">Categorías</h1>
      </motion.div>

      <UserBadge />

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass overflow-hidden rounded-2xl p-4"
          >
            <CategoryForm
              name={name}
              type={type}
              colorCode={colorCode}
              saving={saving}
              editing={Boolean(editingId)}
              onNameChange={setName}
              onTypeChange={setType}
              onColorChange={setColorCode}
              onCancel={resetForm}
              onSubmit={handleSubmit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showForm && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl bg-neonCyan py-4 text-lg font-semibold text-background shadow-cyan"
        >
          + Nueva Categoría
        </motion.button>
      )}

      {(error || coreError) && (
        <ErrorBanner message={error || coreError || ''} onRetry={() => refreshCore()} />
      )}

      <CategorySection
        title="Ingresos"
        items={incomeCategories}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
        emptyText="Sin categorías. Crea una para clasificar ingresos."
      />
      <CategorySection
        title="Gastos"
        items={expenseCategories}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
        emptyText="Sin categorías. Crea una para clasificar gastos."
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Borrar categoría"
        description="Solo se puede borrar si no tiene movimientos asociados."
        confirmLabel="Borrar"
        loading={deleting}
        destructive
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}

function CategorySection({
  title,
  items,
  onEdit,
  onDelete,
  emptyText,
}: {
  title: string
  items: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  emptyText: string
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm text-gray-400">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyText}</p>
        ) : (
          items.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="glass flex items-center justify-between rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: category.color_code }}
                />
                <span className="text-white">{category.name}</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(category)}
                  aria-label={`Editar categoría ${category.name}`}
                  className="p-2 text-gray-500 hover:text-neonCyan"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(category)}
                  aria-label={`Borrar categoría ${category.name}`}
                  className="p-2 text-gray-500 hover:text-neonMagenta"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
