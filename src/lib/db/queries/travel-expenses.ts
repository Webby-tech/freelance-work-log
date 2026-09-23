import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../index'
import { receipts, travelExpenseItems, workEntries } from '../schema'
import type { TravelExpenseItem } from '../schema'
import { calculateReimbursement, type EntryReimbursement } from '../../reimbursement'
import { deleteStoredFiles } from '../../receipt-storage'
import { getReceiptRowsForParents } from './receipts'

export async function getTravelExpenseItems(workEntryId: string): Promise<TravelExpenseItem[]> {
  return db
    .select()
    .from(travelExpenseItems)
    .where(eq(travelExpenseItems.workEntryId, workEntryId))
    .orderBy(travelExpenseItems.createdAt)
}

export interface TravelItemInput {
  id?: string            // present for items that already exist — keeps their receipts attached
  description: string
  amount: string
  reimbursed?: boolean
}

// Saves an entry's travel items and returns the new total.
//
// Items that already exist (matched by id) are UPDATED in place so their receipts stay
// attached; new items are inserted; items no longer submitted are removed together with
// their receipts (file first). Removing an item that has receipts from an INVOICED entry
// is refused — receipts on invoiced entries can be added to, never deleted.
export async function replaceTravelExpenseItems(
  workEntryId: string,
  items: TravelItemInput[]
): Promise<number> {
  const existing = await db
    .select({ id: travelExpenseItems.id })
    .from(travelExpenseItems)
    .where(eq(travelExpenseItems.workEntryId, workEntryId))
  const existingIds = new Set(existing.map(e => e.id))

  const keptIds = new Set(items.filter(i => i.id && existingIds.has(i.id)).map(i => i.id!))
  const removedIds = existing.map(e => e.id).filter(id => !keptIds.has(id))

  const removedReceipts = await getReceiptRowsForParents('travel_expense_item', removedIds)
  if (removedReceipts.length > 0) {
    const [entry] = await db.select({ invoiceId: workEntries.invoiceId }).from(workEntries).where(eq(workEntries.id, workEntryId))
    if (entry?.invoiceId) {
      throw new Error('This entry is invoiced: travel items that have receipts cannot be removed.')
    }
    await deleteStoredFiles(removedReceipts.map(r => r.storageKey))
  }

  await db.transaction(async (tx) => {
    if (removedIds.length > 0) {
      await tx.delete(receipts).where(and(eq(receipts.parentType, 'travel_expense_item'), inArray(receipts.parentId, removedIds)))
      await tx.delete(travelExpenseItems).where(inArray(travelExpenseItems.id, removedIds))
    }
    for (const item of items) {
      if (item.id && existingIds.has(item.id)) {
        await tx
          .update(travelExpenseItems)
          .set({ description: item.description, amount: item.amount, reimbursed: item.reimbursed ?? false })
          .where(eq(travelExpenseItems.id, item.id))
      } else {
        await tx.insert(travelExpenseItems).values({
          workEntryId,
          description: item.description,
          amount: item.amount,
          reimbursed: item.reimbursed ?? false,
        })
      }
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
