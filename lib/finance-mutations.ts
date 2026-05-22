import { SupabaseClient } from '@supabase/supabase-js'
import {
  SavingPot,
  SavingPotMovementType,
  TransactionType,
  UserSettings,
} from '@/lib/types'

export type SaveTransactionInput = {
  id?: string | null
  userId: string
  amount: number
  description: string
  date: string
  type: TransactionType
  categoryId: string
}

export type SaveCategoryInput = {
  id?: string | null
  userId: string
  name: string
  type: TransactionType
  colorCode: string
}

export type SavePotMovementInput = {
  userId: string
  potId: string
  amount: number
  type: SavingPotMovementType
  note: string
}

export async function saveTransaction(
  supabase: SupabaseClient,
  input: SaveTransactionInput
): Promise<{ error: string | null }> {
  const data = {
    user_id: input.userId,
    amount: input.amount,
    description: input.description,
    date: input.date,
    type: input.type,
    category_id: input.categoryId,
  }

  const result = input.id
    ? await supabase.from('transactions').update(data).eq('id', input.id)
    : await supabase.from('transactions').insert(data)

  return { error: result.error ? 'No se pudo guardar el movimiento.' : null }
}

export async function deleteTransaction(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)

  return { error: error ? 'No se pudo borrar el movimiento.' : null }
}

export async function savePotMovement(
  supabase: SupabaseClient,
  input: SavePotMovementInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saving_pot_movements').insert({
    user_id: input.userId,
    pot_id: input.potId,
    amount: input.amount,
    type: input.type,
    note: input.note,
  })

  return { error: error ? 'No se pudo registrar el movimiento de apartado.' : null }
}

export async function saveCategory(
  supabase: SupabaseClient,
  input: SaveCategoryInput
): Promise<{ error: string | null }> {
  const data = {
    user_id: input.userId,
    name: input.name,
    type: input.type,
    color_code: input.colorCode,
  }

  const result = input.id
    ? await supabase.from('categories').update(data).eq('id', input.id)
    : await supabase.from('categories').insert(data)

  return { error: result.error ? 'No se pudo guardar la categoría.' : null }
}

export async function deleteCategory(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('categories').delete().eq('id', id)

  return {
    error: error
      ? 'No se pudo borrar la categoría. Revisa si tiene movimientos asociados.'
      : null,
  }
}

export async function saveInitialBalance(
  supabase: SupabaseClient,
  userId: string,
  settings: UserSettings | null,
  balance: number
): Promise<{ error: string | null }> {
  if (settings) {
    const { error } = await supabase
      .from('user_settings')
      .update({
        initial_balance: balance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)

    return { error: error ? 'No se pudo guardar el balance.' : null }
  }

  const { error } = await supabase.from('user_settings').insert({
    user_id: userId,
    initial_balance: balance,
  })

  return { error: error ? 'No se pudo guardar el balance.' : null }
}

export async function saveSavingPot(
  supabase: SupabaseClient,
  input: { id: string; userId: string; name: string; targetAmount: number; colorCode: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saving_pots')
    .update({
      name: input.name,
      target_amount: input.targetAmount,
      color_code: input.colorCode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('user_id', input.userId)

  return { error: error ? 'No se pudo guardar el apartado.' : null }
}
