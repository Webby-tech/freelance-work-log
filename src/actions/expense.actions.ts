'use server'
import { revalidatePath } from 'next/cache'
import { createExpense, deleteExpense } from '@/lib/db/queries/expenses'
import type { NewExpense } from '@/lib/db/schema'

export async function createExpenseAction(
  values: Omit<NewExpense, 'id' | 'createdAt' | 'updatedAt'>
) {
  const expense = await createExpense(values)
  revalidatePath('/')
  return expense
}

export async function deleteExpenseAction(id: string) {
  await deleteExpense(id)
  revalidatePath('/')
}
