'use client'

import { TransactionType } from '@/lib/types'

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

interface CategoryFormProps {
  name: string
  type: TransactionType
  colorCode: string
  saving: boolean
  editing: boolean
  onNameChange: (value: string) => void
  onTypeChange: (value: TransactionType) => void
  onColorChange: (value: string) => void
  onCancel: () => void
  onSubmit: (event: React.FormEvent) => void
}

export function CategoryForm({
  name,
  type,
  colorCode,
  saving,
  editing,
  onNameChange,
  onTypeChange,
  onColorChange,
  onCancel,
  onSubmit,
}: CategoryFormProps) {
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
      </div>

      <div>
        <label htmlFor="category-name" className="mb-2 block text-sm text-gray-300">
          Nombre
        </label>
        <input
          id="category-name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Nombre de categoría"
          className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white placeholder-gray-500 focus:border-neonCyan/50 focus:outline-none"
          required
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-gray-400" id="category-color-label">
          Color
        </p>
        <div className="flex flex-wrap gap-2">
          {presetColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              aria-label={`Elegir color ${color}`}
              aria-pressed={colorCode === color}
              className={`h-10 w-10 rounded-full transition-all ${
                colorCode === color
                  ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-background'
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
          onClick={onCancel}
          className="flex-1 rounded-lg bg-white/10 py-3 font-medium text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-neonCyan py-3 font-semibold text-background shadow-cyan disabled:opacity-50"
        >
          {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  )
}
