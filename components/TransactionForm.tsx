'use client'

import { Category, SavingPotMovementType, TransactionType } from '@/lib/types'

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
  onAmountChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onDateChange: (value: string) => void
  onTypeChange: (value: MovementFormType) => void
  onPotActionChange: (value: SavingPotMovementType) => void
  onCategoryChange: (value: string) => void
  onCancel: () => void
  onSubmit: (event: React.FormEvent) => void
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
  onAmountChange,
  onDescriptionChange,
  onDateChange,
  onTypeChange,
  onPotActionChange,
  onCategoryChange,
  onCancel,
  onSubmit,
}: TransactionFormProps) {
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

      <div>
        <label htmlFor="transaction-description" className="mb-2 block text-sm text-gray-300">
          Descripción
        </label>
        <input
          id="transaction-description"
          type="text"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Descripción (opcional)"
          className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white placeholder-gray-500 focus:border-neonCyan/50 focus:outline-none"
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
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-white focus:border-neonCyan/50 focus:outline-none"
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
          </select>
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
          disabled={saving}
          className="flex-1 rounded-lg bg-neonCyan py-3 font-semibold text-background shadow-cyan disabled:opacity-50"
        >
          {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
        </button>
      </div>
    </form>
  )
}
