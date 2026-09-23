'use server'
import { revalidatePath } from 'next/cache'
import { createEntry, updateEntry, deleteEntry } from '@/lib/db/queries/entries'
import { replaceTravelExpenseItems } from '@/lib/db/queries/travel-expenses'
import { parseCap } from '@/lib/reimbursement'
import type { NewWorkEntry, WorkEntry } from '@/lib/db/schema'

// `id` is set for items that already exist, so saving keeps their receipts attached.
export type TravelItem = { id?: string; description: string; amount: string; reimbursed?: boolean }

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

// Deletes the entry and any receipts attached to its travel items (files included).
export async function deleteEntryAction(
  id: string
): Promise<{ ok: true; deletedReceipts: number } | { ok: false; error: string }> {
  try {
    const deletedReceipts = await deleteEntry(id)
    revalidatePath('/log')
    revalidatePath('/reports')
    revalidatePath('/receipts')
    revalidatePath('/')
    return { ok: true, deletedReceipts }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
