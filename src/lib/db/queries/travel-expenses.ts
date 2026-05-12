import { supabaseAdmin } from '../index'
import type { TravelExpenseItem } from '../schema'
import { fromDb } from '../mappers'

export async function getTravelExpenseItems(workEntryId: string): Promise<TravelExpenseItem[]> {
  const { data, error } = await supabaseAdmin
    .from('travel_expense_items')
    .select('*')
    .eq('work_entry_id', workEntryId)
    .order('created_at')
  if (error) throw error
  return (data as unknown[]).map(r => fromDb<TravelExpenseItem>(r))
}

// Replaces all items for a work entry and returns the new total
export async function replaceTravelExpenseItems(
  workEntryId: string,
  items: { description: string; amount: string }[]
): Promise<number> {
  // Delete existing
  const { error: delErr } = await supabaseAdmin
    .from('travel_expense_items')
    .delete()
    .eq('work_entry_id', workEntryId)
  if (delErr) throw delErr

  if (items.length === 0) return 0

  const rows = items.map(i => ({
    work_entry_id: workEntryId,
    description:   i.description,
    amount:        i.amount,
  }))

  const { error: insErr } = await supabaseAdmin
    .from('travel_expense_items')
    .insert(rows)
  if (insErr) throw insErr

  return items.reduce((sum, i) => sum + Number(i.amount), 0)
}
