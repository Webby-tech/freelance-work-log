'use server'
import { revalidatePath } from 'next/cache'
import { createEntry, updateEntry, deleteEntry } from '@/lib/db/queries/entries'
import { replaceTravelExpenseItems } from '@/lib/db/queries/travel-expenses'
import { parseCap } from '@/lib/reimbursement'
import type { NewWorkEntry, WorkEntry } from '@/lib/db/schema'

export type TravelItem = { description: string; amount: string; reimbursed?: boolean }

// Empty / invalid / negative cap → null (no cap). Otherwise stored as a 2dp string.
function normaliseCap(cap: string | null | undefined): string | null {
  const n = parseCap(cap)
  return n === null ? null : n.toFixed(2)
}

export async function createEntryAction(
  values: Omit<NewWorkEntry, 'id' | 'createdAt' | 'updatedAt'>,
  travelItems: TravelItem[] = []
) {
  const total  = travelItems.reduce((s, i) => s + Number(i.amount), 0)
  const entry  = await createEntry({
    ...values,
    travelExpenses: String(total),
    travelReimbursementCap: normaliseCap(values.travelReimbursementCap),
  })
  if (travelItems.length > 0) {
    await replaceTravelExpenseItems(entry.id, travelItems)
  }
  revalidatePath('/log')
  revalidatePath('/reports')
  revalidatePath('/')
  return entry
}

export async function updateEntryAction(
  id: string,
  values: Partial<WorkEntry>,
  travelItems: TravelItem[] = []
) {
  const total = travelItems.reduce((s, i) => s + Number(i.amount), 0)
  const entry = await updateEntry(id, {
    ...values,
    travelExpenses: String(total),
    ...('travelReimbursementCap' in values
      ? { travelReimbursementCap: normaliseCap(values.travelReimbursementCap) }
      : {}),
  })
  await replaceTravelExpenseItems(id, travelItems)
  revalidatePath('/log')
  revalidatePath('/reports')
  revalidatePath('/')
  return entry
}

export async function deleteEntryAction(id: string) {
  await deleteEntry(id)
  revalidatePath('/log')
  revalidatePath('/reports')
  revalidatePath('/')
}
