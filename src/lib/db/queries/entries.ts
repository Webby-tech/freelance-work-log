import { and, desc, eq, gte, isNotNull, isNull, lte, type SQL } from 'drizzle-orm'
import { db } from '../index'
import { workEntries } from '../schema'
import type { WorkEntry, NewWorkEntry, Client } from '../schema'
import { getCurrentTaxYear } from '../../tax-year'

export type WorkEntryWithClient = WorkEntry & { client: Client }

export interface EntryFilters {
  clientId?: string
  month?: string       // 'YYYY-MM'
  taxYear?: boolean    // if true, filter to current tax year
  taxYearBounds?: { start: string; end: string }  // explicit bounds for any tax year
  invoiced?: boolean   // if true, only invoiced; if false, only uninvoiced
}

export async function getEntries(filters: EntryFilters = {}): Promise<WorkEntryWithClient[]> {
  const conditions: SQL[] = []

  if (filters.clientId) {
    conditions.push(eq(workEntries.clientId, filters.clientId))
  }
  if (filters.month) {
    conditions.push(gte(workEntries.date, `${filters.month}-01`))
    conditions.push(lte(workEntries.date, `${filters.month}-31`))
  } else if (filters.taxYearBounds) {
    conditions.push(gte(workEntries.date, filters.taxYearBounds.start))
    conditions.push(lte(workEntries.date, filters.taxYearBounds.end))
  } else if (filters.taxYear) {
    const { start, end } = getCurrentTaxYear()
    conditions.push(gte(workEntries.date, start.toISOString().split('T')[0]))
    conditions.push(lte(workEntries.date, end.toISOString().split('T')[0]))
  }
  if (filters.invoiced === true) {
    conditions.push(isNotNull(workEntries.invoiceId))
  } else if (filters.invoiced === false) {
    conditions.push(isNull(workEntries.invoiceId))
  }

  return db.query.workEntries.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(workEntries.date),
    with: { client: true },
  })
}

export async function getEntry(id: string): Promise<WorkEntryWithClient | null> {
  const entry = await db.query.workEntries.findFirst({
    where: eq(workEntries.id, id),
    with: { client: true },
  })
  return entry ?? null
}

export async function createEntry(
  values: Omit<NewWorkEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WorkEntry> {
  const [entry] = await db.insert(workEntries).values(values).returning()
  return entry
}

export async function updateEntry(id: string, values: Partial<WorkEntry>): Promise<WorkEntry> {
  const [entry] = await db
    .update(workEntries)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(workEntries.id, id))
    .returning()
  return entry
}

export async function deleteEntry(id: string): Promise<void> {
  const entry = await getEntry(id)
  if (entry?.invoiceId) {
    throw new Error('Cannot delete an invoiced entry. Void the invoice first.')
  }
  await db.delete(workEntries).where(eq(workEntries.id, id))
}

export async function getYtdMiles(): Promise<number> {
  const { start, end } = getCurrentTaxYear()
  const rows = await db
    .select({ returnMiles: workEntries.returnMiles })
    .from(workEntries)
    .where(
      and(
        gte(workEntries.date, start.toISOString().split('T')[0]),
        lte(workEntries.date, end.toISOString().split('T')[0])
      )
    )
  return rows.reduce((sum, e) => sum + (e.returnMiles ?? 0), 0)
}

export async function getUninvoicedSummary(): Promise<{ count: number; totalFees: number; totalMileage: number }> {
  const { start, end } = getCurrentTaxYear()
  const rows = await db
    .select({
      flatFee: workEntries.flatFee,
      returnMiles: workEntries.returnMiles,
      mileageRate: workEntries.mileageRate,
    })
    .from(workEntries)
    .where(
      and(
        isNull(workEntries.invoiceId),
        gte(workEntries.date, start.toISOString().split('T')[0]),
        lte(workEntries.date, end.toISOString().split('T')[0])
      )
    )
  let totalFees = 0
  let totalMileage = 0
  for (const e of rows) {
    totalFees += Number(e.flatFee)
    totalMileage += (e.returnMiles ?? 0) * Number(e.mileageRate ?? 0.45)
  }
  return { count: rows.length, totalFees, totalMileage }
}
