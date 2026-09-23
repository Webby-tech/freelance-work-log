'use server'
import { revalidatePath } from 'next/cache'
import { createExpense, deleteExpense } from '@/lib/db/queries/expenses'
import type { NewExpense } from '@/lib/db/schema'

export async function createExpenseAction(
  values: Omit<NewExpense, 'id' | 'createdAt' | 'updatedAt'>
) {
  const expense = await createExpense(values)
  revalidatePath('/')
  revalidatePath('/receipts')
  return expense
}

// Deletes the expense together with its receipts (files included). Returns a result rather
// than throwing so the browser can show the real reason if storage can't be reached.
export async function deleteExpenseAction(
  id: string
): Promise<{ ok: true; deletedReceipts: number } | { ok: false; error: string }> {
  try {
    const deletedReceipts = await deleteExpense(id)
    for (const p of ['/', '/receipts', '/reports']) revalidatePath(p)
    return { ok: true, deletedReceipts }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
