import { eq } from 'drizzle-orm'
import { db } from '../index'
import { travelExpenseItems } from '../schema'
import type { TravelExpenseItem } from '../schema'

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
  items: { description: string; amount: string }[]
): Promise<number> {
  await db.transaction(async (tx) => {
    await tx.delete(travelExpenseItems).where(eq(travelExpenseItems.workEntryId, workEntryId))

    if (items.length > 0) {
      await tx.insert(travelExpenseItems).values(
        items.map(i => ({
          workEntryId,
          description: i.description,
          amount: i.amount,
        }))
      )
    }
  })

  return items.reduce((sum, i) => sum + Number(i.amount), 0)
}
