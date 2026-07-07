import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../index'
import { expenses } from '../schema'
import type { Expense, NewExpense } from '../schema'
import { getCurrentTaxYear } from '../../tax-year'

export interface RecentExpenseItem {
  description: string
  category:    string
  amount:      string
}

// Returns one entry per unique description — the most recently logged values.
export async function getRecentUniqueExpenses(): Promise<RecentExpenseItem[]> {
  const rows = await db
    .select({
      description: expenses.description,
      category: expenses.category,
      amount: expenses.amount,
    })
    .from(expenses)
    .orderBy(desc(expenses.createdAt))
  const seen = new Map<string, RecentExpenseItem>()
  for (const row of rows) {
    if (!seen.has(row.description)) {
      seen.set(row.description, row)
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description))
}

export async function getYtdExpenses(): Promise<Expense[]> {
  const { start, end } = getCurrentTaxYear()
  return db
    .select()
    .from(expenses)
    .where(
      and(
        gte(expenses.date, start.toISOString().split('T')[0]),
        lte(expenses.date, end.toISOString().split('T')[0])
      )
    )
    .orderBy(desc(expenses.date))
}

export async function getYtdExpensesTotal(): Promise<number> {
  const { start, end } = getCurrentTaxYear()
  const rows = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(
      and(
        gte(expenses.date, start.toISOString().split('T')[0]),
        lte(expenses.date, end.toISOString().split('T')[0])
      )
    )
  return rows.reduce((s, e) => s + Number(e.amount), 0)
}

export async function createExpense(
  values: Omit<NewExpense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Expense> {
  const [expense] = await db.insert(expenses).values(values).returning()
  return expense
}

export async function deleteExpense(id: string): Promise<void> {
  await db.delete(expenses).where(eq(expenses.id, id))
}
