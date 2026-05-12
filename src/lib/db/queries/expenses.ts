import { supabaseAdmin } from '../index'
import type { Expense, NewExpense } from '../schema'
import { getCurrentTaxYear } from '../../tax-year'
import { fromDb, toDb } from '../mappers'

export interface RecentExpenseItem {
  description: string
  category:    string
  amount:      string
}

// Returns one entry per unique description — the most recently logged values.
export async function getRecentUniqueExpenses(): Promise<RecentExpenseItem[]> {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('description, category, amount, created_at')
    .order('created_at', { ascending: false })
  if (error) return []
  const seen = new Map<string, RecentExpenseItem>()
  for (const row of data as { description: string; category: string; amount: string; created_at: string }[]) {
    if (!seen.has(row.description)) {
      seen.set(row.description, { description: row.description, category: row.category, amount: row.amount })
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description))
}

export async function getYtdExpenses(): Promise<Expense[]> {
  const { start, end } = getCurrentTaxYear()
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])
    .order('date', { ascending: false })
  if (error) return []
  return (data as unknown[]).map(row => fromDb<Expense>(row))
}

export async function getYtdExpensesTotal(): Promise<number> {
  const { start, end } = getCurrentTaxYear()
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('amount')
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])
  if (error) return 0
  return (data as { amount: string }[]).reduce((s, e) => s + Number(e.amount), 0)
}

export async function createExpense(
  values: Omit<NewExpense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Expense> {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .insert(toDb(values))
    .select()
    .single()
  if (error) throw new Error(error.message)
  return fromDb<Expense>(data)
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('expenses')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
