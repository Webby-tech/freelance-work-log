import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../index'
import { travelExpenseItems, workEntries } from '../schema'
import type { TravelExpenseItem } from '../schema'
import { calculateReimbursement, type EntryReimbursement } from '../../reimbursement'

export async function getTravelExpenseItems(workEntryId: string): Promise<TravelExpenseItem[]> {
  return db
    .select()
    .from(travelExpenseItems)
    .where(eq(travelExpenseItems.workEntryId, workEntryId))
    .orderBy(travelExpenseItems.createdAt)
}

// Replaces all items for a work entry and returns the new total
export async function replaceTravelExpenseItems(
  workEntryId: string,
  items: { description: string; amount: string; reimbursed?: boolean }[]
): Promise<number> {
  await db.transaction(async (tx) => {
    await tx.delete(travelExpenseItems).where(eq(travelExpenseItems.workEntryId, workEntryId))

    if (items.length > 0) {
      await tx.insert(travelExpenseItems).values(
        items.map(i => ({
          workEntryId,
          description: i.description,
          amount: i.amount,
          reimbursed: i.reimbursed ?? false,
        }))
      )
    }
  })

  return items.reduce((sum, i) => sum + Number(i.amount), 0)
}

// Reimbursement (capped, billable) for the given entries. Only entries that have at least one
// item ticked "reimbursed" appear in the result — every other entry is unaffected by the feature.
export async function getReimbursementByEntry(entryIds: string[]): Promise<Record<string, EntryReimbursement>> {
  if (entryIds.length === 0) return {}
  const rows = await db
    .select({
      entryId: travelExpenseItems.workEntryId,
      amount: travelExpenseItems.amount,
      cap: workEntries.travelReimbursementCap,
    })
    .from(travelExpenseItems)
    .innerJoin(workEntries, eq(workEntries.id, travelExpenseItems.workEntryId))
    .where(and(eq(travelExpenseItems.reimbursed, true), inArray(travelExpenseItems.workEntryId, entryIds)))

  const grouped = new Map<string, { cap: string | null; items: { amount: string; reimbursed: boolean }[] }>()
  for (const r of rows) {
    const g = grouped.get(r.entryId) ?? { cap: r.cap, items: [] }
    g.items.push({ amount: r.amount, reimbursed: true })
    grouped.set(r.entryId, g)
  }

  const result: Record<string, EntryReimbursement> = {}
  for (const [id, g] of grouped) result[id] = calculateReimbursement(g.items, g.cap)
  return result
}
