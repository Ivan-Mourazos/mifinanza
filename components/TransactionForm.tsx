'use client'

import { useEffect, useRef, useState } from 'react'
import { Category, SavingPotMovementType, TransactionType } from '@/lib/types'

export interface DescriptionSuggestion {
  description: string
  categoryId: string
  type: TransactionType
}

export type MovementFormType = TransactionType | 'pot'

interface TransactionFormProps {
  amount: string
  description: string
  date: string
  type: MovementFormType
  potAction: SavingPotMovementType
  categoryId: string
  categories: Category[]
  saving: boolean
  editing: boolean
  descriptionSuggestions?: DescriptionSuggestion[]
  onAmountChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onDateChange: (value: string) => void
  onTypeChange: (value: MovementFormType) => void
  onPotActionChange: (value: SavingPotMovementType) => void
  onCategoryChange: (value: string) => void
  onCancel: () => void
  onSubmit: (event: React.FormEvent) => void
  onCreateCategory?: (name: string, colorCode: string) => Promise<{ data: Category | null; error: string | null }>
}

export function TransactionForm({
  amount,
  description,
  date,
  type,
  potAction,
  categoryId,
  categories,
  saving,
  editing,
  descriptionSuggestions = [],
  onAmountChange,
  onDescriptionChange,
  onDateChange,
  onTypeChange,
  onPotActionChange,
  onCategoryChange,
  onCancel,
  onSubmit,
  onCreateCategory,
}: TransactionFormProps) {
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#22C55E')
  const [creatingCat, setCreatingCat] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)

  // ── Autocomplete state ────────────────────────────────────────────────────
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const descWrapperRef = useRef<HTMLDivElement>(null)

  // Filter suggestions by current type (expense/income) and query
  const filteredSuggestions = descriptionSuggestions
    .filter(
      (s) =>
        (type === 'pot' || s.type === type) &&
        s.description.toLowerCase().includes(description.toLowerCase())
    )
    .slice(0, 8) // max 8 items

  // Close on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (descWrapperRef.current && !descWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleDescriptionChange = (value: string) => {
    onDescriptionChange(value)
    setShowSuggestions(true)
    setHighlightedIndex(-1)
  }

  const handleSelectSuggestion = (suggestion: DescriptionSuggestion) => {
    onDescriptionChange(suggestion.description)
    // Auto-select category only if it matches the current transaction type
    if (type !== 'pot' && suggestion.type === type) {
      onCategoryChange(suggestion.categoryId)
    }
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelectSuggestion(filteredSuggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    }
  }

  const handleCreateCategorySubmit = async () => {
    const trimmed = newCatName.trim()
    if (!trimmed || !onCreateCategory) return

    setCreatingCat(true)
    setCatError(null)

    try {
      const result = await onCreateCategory(trimmed, newCatColor)
      if (result.error) {
        setCatError(result.error)
      } else if (result.data) {
        onCategoryChange(result.data.id)
        setNewCatName('')
        setNewCatColor('#22C55E')
      }
    } catch (err) {
      setCatError('Error al crear la categoría.')
    } finally {
      setCreatingCat(false)
    }
  }

  const filteredCategories =
    type === 'pot' ? [] : categories.filter((category) => category.type === type)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2 rounded-lg bg-white/5 p-1">
        <button
          type="button"
          onClick={() => onTypeChange('expense')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            type === 'expense' ? 'bg-neonMagenta text-white' : 'text-gray-400'
          }`}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => onTypeChange('income')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            type === 'income' ? 'bg-neonGreen text-background' : 'text-gray-400'
          }`}
        >
          Ingreso
        </button>
        <button
          type="button"
          onClick={() => onTypeChange('pot')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            type === 'pot' ? 'bg-neonCyan text-background' : 'text-gray-400'
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
            onChange={(event) =>
              onPotActionChange(event.target.value as SavingPotMovementType)
            }
            className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:border-neonCyan/50 focus:outline-none"
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
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-center text-2xl text-white focus:border-neonCyan/50 focus:outline-none"
          required
        />
      </div>

      <div ref={descWrapperRef} className="relative">
        <label htmlFor="transaction-description" className="mb-2 block text-sm text-gray-300">
          Descripción
        </label>
        <div className="relative">
          <input
            id="transaction-description"
            type="text"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleDescriptionKeyDown}
            placeholder="Descripción (opcional)"
            autoComplete="off"
            className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-neonCyan/50 focus:outline-none"
          />
          {/* Toggle button */}
          {descriptionSuggestions.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowSuggestions((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-neonCyan transition-colors"
              aria-label="Ver sugerencias"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 transition-transform duration-200 ${
                  showSuggestions ? 'rotate-180' : ''
                }`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl"
          >
            {filteredSuggestions.map((suggestion, idx) => (
              <li
                key={`${suggestion.description}-${idx}`}
                role="option"
                aria-selected={idx === highlightedIndex}
                onMouseDown={(e) => {
                  e.preventDefault() // prevent input blur before click registers
                  handleSelectSuggestion(suggestion)
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                  idx === highlightedIndex
                    ? 'bg-neonCyan/10 text-neonCyan'
                    : 'text-gray-300 hover:bg-white/5'
                } ${
                  idx < filteredSuggestions.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <span className="min-w-0 truncate">{suggestion.description}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    suggestion.type === 'income'
                      ? 'bg-neonGreen/10 text-neonGreen'
                      : 'bg-neonMagenta/10 text-neonMagenta'
                  }`}
                >
                  {suggestion.type === 'income' ? 'Ingreso' : 'Gasto'}
                </span>
              </li>
            ))}
          </ul>
        )}
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
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:border-neonCyan/50 focus:outline-none"
            required
          />
        </div>
      )}

      {type !== 'pot' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="transaction-category" className="mb-2 block text-sm text-gray-300">
              Categoría
            </label>
            <select
              id="transaction-category"
              value={categoryId}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:border-neonCyan/50 focus:outline-none"
              required
            >
              <option value="">Seleccionar categoría</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="__new__" className="text-neonCyan font-semibold">
                + Nueva Categoría...
              </option>
            </select>
          </div>

          {categoryId === '__new__' && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">Nueva Categoría</p>
              {catError && <p className="text-xs text-neonMagenta">{catError}</p>}
              <div>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nombre de la categoría (ej. Gimnasio)"
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-neonCyan/50 focus:outline-none"
                  required={categoryId === '__new__'}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#FF2D55', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#A855F7', '#EC4899', '#14B8A6', '#F43F5E', '#D946EF', '#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#64748B'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className={`h-6 w-6 rounded-full border-2 transition-all ${
                        newCatColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={creatingCat || !newCatName.trim()}
                  onClick={handleCreateCategorySubmit}
                  className="flex-1 rounded-lg bg-neonCyan py-2 text-xs font-semibold text-background disabled:opacity-50"
                >
                  {creatingCat ? 'Creando...' : 'Crear Categoría'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCategoryChange('')
                    setCatError(null)
                    setNewCatName('')
                  }}
                  className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-medium text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg bg-white/10 py-3 font-medium text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || categoryId === '__new__'}
          className="flex-1 rounded-lg bg-neonCyan py-3 font-semibold text-background shadow-cyan disabled:opacity-50"
        >
          {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
        </button>
      </div>
    </form>
  )
}
