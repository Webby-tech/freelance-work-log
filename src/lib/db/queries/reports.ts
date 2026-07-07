import { and, gte, inArray, lte } from 'drizzle-orm'
import { db } from '../index'
import { expenses, invoices, travelExpenseItems, workEntries } from '../schema'
import type { WorkEntry, Client, Invoice, Agent, Expense, TravelExpenseItem } from '../schema'

export type ReportEntry   = WorkEntry & { client: Client; travelItems: TravelExpenseItem[] }
export type ReportInvoice = Invoice  & { client: Client | null; agent: Agent | null }

export interface ReportData {
  entries:  ReportEntry[]
  invoices: ReportInvoice[]
  expenses: Expense[]
}

export async function getReportData(start: string, end: string): Promise<ReportData> {
  const [entries, reportInvoices, expensesRows] = await Promise.all([
    db.query.workEntries.findMany({
      where: and(gte(workEntries.date, start), lte(workEntries.date, end)),
      orderBy: workEntries.date,
      with: { client: true },
    }),
    db.query.invoices.findMany({
      where: and(gte(invoices.periodStart, start), lte(invoices.periodStart, end)),
      orderBy: invoices.periodStart,
      with: { client: true, agent: true },
    }),
    db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, start), lte(expenses.date, end)))
      .orderBy(expenses.date),
  ])

  // Fetch travel expense items for all entries in one query
  const entryIds = entries.map(e => e.id)
  const travelItemsMap = new Map<string, TravelExpenseItem[]>()
  if (entryIds.length > 0) {
    const items = await db
      .select()
      .from(travelExpenseItems)
      .where(inArray(travelExpenseItems.workEntryId, entryIds))
      .orderBy(travelExpenseItems.createdAt)
    for (const item of items) {
      const list = travelItemsMap.get(item.workEntryId) ?? []
      list.push(item)
      travelItemsMap.set(item.workEntryId, list)
    }
  }

  return {
    entries:  entries.map(e => ({ ...e, travelItems: travelItemsMap.get(e.id) ?? [] })),
    invoices: reportInvoices,
    expenses: expensesRows,
  }
}
