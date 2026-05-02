'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Navigation } from '@/components/Navigation'
import { useRouter } from 'next/navigation'
import { UserBadge } from '@/components/UserBadge'
import { defaultCategories } from '@/lib/finance'
import { Category } from '@/lib/types'

const presetColors = [
  '#00FF88',
  '#FF2D55',
  '#FF6B6B',
  '#FFD93D',
  '#00D9FF',
  '#A855F7',
  '#F97316',
  '#3B82F6',
]

export default function CategoriesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [colorCode, setColorCode] = useState('#FF2D55')
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

    const res = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (res.error) {
      setError('No se pudieron cargar las categorías.')
      setLoading(false)
      return
    }

    if (!res.data || res.data.length === 0) {
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

      const seededRes = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (seededRes.error) {
        setError('No se pudieron cargar las categorías iniciales.')
        setLoading(false)
        return
      }

      setCategories(seededRes.data || [])
      setLoading(false)
      return
    }

    setCategories(res.data || [])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetForm = () => {
    setName('')
    setType('expense')
    setColorCode('#FF2D55')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!user || !trimmedName) {
      setError('Escribe un nombre para la categoría.')
      return
    }

    setSaving(true)
    setError(null)

    const data = {
      user_id: user.id,
      name: trimmedName,
      type,
      color_code: colorCode,
    }

    const result = editingId
      ? await supabase.from('categories').update(data).eq('id', editingId)
      : await supabase.from('categories').insert(data)

    if (result.error) {
      setError('No se pudo guardar la categoría.')
      setSaving(false)
      return
    }

    await fetchData()
    resetForm()
    setSaving(false)
  }

  const handleEdit = (cat: Category) => {
    setName(cat.name)
    setType(cat.type)
    setColorCode(cat.color_code)
    setEditingId(cat.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('¿Quieres borrar esta categoría?')
    if (!confirmed) return

    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      setError('No se pudo borrar la categoría. Revisa si tiene movimientos asociados.')
      return
    }

    await fetchData()
  }

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  )
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-neonCyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Cargando categorías...</p>
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
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
        </motion.div>

        <UserBadge user={user} />

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
                </div>

                <div>
                  <label htmlFor="category-name" className="mb-2 block text-sm text-gray-300">
                    Nombre
                  </label>
                  <input
                    id="category-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre de categoría"
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neonCyan/50"
                    required
                  />
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-2" id="category-color-label">
                    Color
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setColorCode(color)}
                        aria-label={`Elegir color ${color}`}
                        aria-pressed={colorCode === color}
                        className={`w-10 h-10 rounded-full transition-all ${
                          colorCode === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

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
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
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
            + Nueva Categoría
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

        <div className="space-y-6">
          <div>
            <h3 className="text-gray-400 text-sm mb-2">Ingresos</h3>
            <div className="space-y-2">
              {incomeCategories.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin categorías. Crea una para clasificar ingresos.</p>
              ) : (
                incomeCategories.map((cat, i) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: cat.color_code }}
                      />
                      <span className="text-white">{cat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        aria-label={`Editar categoría ${cat.name}`}
                        className="p-2 text-gray-500 hover:text-neonCyan"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        aria-label={`Borrar categoría ${cat.name}`}
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

          <div>
            <h3 className="text-gray-400 text-sm mb-2">Gastos</h3>
            <div className="space-y-2">
              {expenseCategories.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin categorías. Crea una para clasificar gastos.</p>
              ) : (
                expenseCategories.map((cat, i) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: cat.color_code }}
                      />
                      <span className="text-white">{cat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        aria-label={`Editar categoría ${cat.name}`}
                        className="p-2 text-gray-500 hover:text-neonCyan"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        aria-label={`Borrar categoría ${cat.name}`}
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
        </div>
      </div>

      <Navigation />
    </div>
  )
}