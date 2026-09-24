import { and, between, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../index'
import { clients, expenses, receipts, travelExpenseItems, workEntries } from '../schema'
import type { NewReceipt, Receipt, ReceiptParentType } from '../schema'

// What the browser is allowed to see about a receipt. Deliberately has NO storage key:
// files are only ever fetched through the authenticated /api/receipts/[id] route.
export interface ReceiptView {
  id: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
}

export const toReceiptView = (r: Receipt): ReceiptView => ({
  id: r.id,
  originalFilename: r.originalFilename,
  mimeType: r.mimeType,
  sizeBytes: r.sizeBytes,
  uploadedAt: r.uploadedAt.toISOString(),
})

export async function getReceipt(id: string): Promise<Receipt | null> {
  const rows = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1)
  return rows[0] ?? null
}

// Full rows (including storage keys) — server-side use only.
export async function getReceiptRowsForParents(type: ReceiptParentType, parentIds: string[]): Promise<Receipt[]> {
  if (parentIds.length === 0) return []
  return db
    .select()
    .from(receipts)
    .where(and(eq(receipts.parentType, type), inArray(receipts.parentId, parentIds)))
    .orderBy(receipts.uploadedAt)
}

// Browser-safe views, grouped by parent id.
export async function getReceiptsForParents(type: ReceiptParentType, parentIds: string[]): Promise<Record<string, ReceiptView[]>> {
  const rows = await getReceiptRowsForParents(type, parentIds)
  const out: Record<string, ReceiptView[]> = {}
  for (const r of rows) (out[r.parentId] ??= []).push(toReceiptView(r))
  return out
}

export async function insertReceipt(values: NewReceipt): Promise<Receipt> {
  const [row] = await db.insert(receipts).values(values).returning()
  return row
}

export async function deleteReceiptRow(id: string): Promise<void> {
  await db.delete(receipts).where(eq(receipts.id, id))
}

export async function parentExists(type: ReceiptParentType, id: string): Promise<boolean> {
  const table = type === 'professional_expense' ? expenses : travelExpenseItems
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1)
  return rows.length > 0
}

// A travel item on an invoiced entry is locked: receipts can be added, never removed.
export async function isParentLocked(type: ReceiptParentType, id: string): Promise<boolean> {
  if (type !== 'travel_expense_item') return false
  const rows = await db
    .select({ invoiceId: workEntries.invoiceId })
    .from(travelExpenseItems)
    .innerJoin(workEntries, eq(workEntries.id, travelExpenseItems.workEntryId))
    .where(eq(travelExpenseItems.id, id))
    .limit(1)
  return !!rows[0]?.invoiceId
}

// Receipts on REIMBURSED travel items belonging to the given entries — i.e. the evidence for
// what a client is being asked to reimburse at cost on a standard invoice. Non-reimbursed
// travel items and professional expenses are never billed to a client, so their receipts are
// intentionally excluded: this is only for what goes on the invoice itself.
export async function getReimbursedTravelReceiptsForEntries(entryIds: string[]): Promise<ReceiptView[]> {
  if (entryIds.length === 0) return []
  const rows = await db
    .select({
      id: receipts.id,
      originalFilename: receipts.originalFilename,
      mimeType: receipts.mimeType,
      sizeBytes: receipts.sizeBytes,
      uploadedAt: receipts.uploadedAt,
    })
    .from(receipts)
    .innerJoin(travelExpenseItems, and(eq(receipts.parentType, 'travel_expense_item'), eq(receipts.parentId, travelExpenseItems.id)))
    .where(and(eq(travelExpenseItems.reimbursed, true), inArray(travelExpenseItems.workEntryId, entryIds)))
    .orderBy(receipts.uploadedAt)
  return rows.map(r => ({ ...r, uploadedAt: r.uploadedAt.toISOString() }))
}

// Per work entry: how many travel items it has, how many of those have a receipt, and the
// total number of receipts (used for the log-list indicator and delete confirmations).
// Entries with no travel items are absent from the result.
export interface TravelReceiptStatus { items: number; itemsWithReceipts: number; receipts: number }

export async function getTravelReceiptStatus(entryIds: string[]): Promise<Record<string, TravelReceiptStatus>> {
  if (entryIds.length === 0) return {}
  const [items, receiptRows] = await Promise.all([
    db
      .select({ id: travelExpenseItems.id, entryId: travelExpenseItems.workEntryId })
      .from(travelExpenseItems)
      .where(inArray(travelExpenseItems.workEntryId, entryIds)),
    db
      .select({ parentId: receipts.parentId })
      .from(receipts)
      .innerJoin(travelExpenseItems, and(eq(receipts.parentType, 'travel_expense_item'), eq(receipts.parentId, travelExpenseItems.id)))
      .where(inArray(travelExpenseItems.workEntryId, entryIds)),
  ])
  const perItem = new Map<string, number>()
  for (const r of receiptRows) perItem.set(r.parentId, (perItem.get(r.parentId) ?? 0) + 1)

  const out: Record<string, TravelReceiptStatus> = {}
  for (const it of items) {
    const s = (out[it.entryId] ??= { items: 0, itemsWithReceipts: 0, receipts: 0 })
    const n = perItem.get(it.id) ?? 0
    s.items += 1
    if (n > 0) s.itemsWithReceipts += 1
    s.receipts += n
  }
  return out
}

// ── Expense ledger: every item of claimed expenditure for a period, with its receipts ──

export interface LedgerRow {
  kind: ReceiptParentType
  id: string
  date: string
  description: string
  amount: number
  detail: string          // category, or "job — client" for travel items
  reimbursed: boolean
  locked: boolean         // on an invoiced entry
  receipts: ReceiptView[]
}

export async function getExpenseLedger(start: string, end: string): Promise<LedgerRow[]> {
  const [proExpenses, travelItems] = await Promise.all([
    db.select().from(expenses).where(between(expenses.date, start, end)).orderBy(desc(expenses.date)),
    db
      .select({
        id: travelExpenseItems.id,
        description: travelExpenseItems.description,
        amount: travelExpenseItems.amount,
        reimbursed: travelExpenseItems.reimbursed,
        date: workEntries.date,
        location: workEntries.locationName,
        invoiceId: workEntries.invoiceId,
        client: clients.name,
      })
      .from(travelExpenseItems)
      .innerJoin(workEntries, eq(workEntries.id, travelExpenseItems.workEntryId))
      .innerJoin(clients, eq(clients.id, workEntries.clientId))
      .where(between(workEntries.date, start, end))
      .orderBy(desc(workEntries.date)),
  ])
  const [proReceipts, travelReceipts] = await Promise.all([
    getReceiptsForParents('professional_expense', proExpenses.map(e => e.id)),
    getReceiptsForParents('travel_expense_item', travelItems.map(t => t.id)),
  ])

  const rows: LedgerRow[] = [
    ...proExpenses.map(e => ({
      kind: 'professional_expense' as const,
      id: e.id,
      date: e.date,
      description: e.description,
      amount: Number(e.amount),
      detail: e.category,
      reimbursed: false,
      locked: false,
      receipts: proReceipts[e.id] ?? [],
    })),
    ...travelItems.map(t => ({
      kind: 'travel_expense_item' as const,
      id: t.id,
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      detail: `${t.location} — ${t.client}`,
      reimbursed: t.reimbursed,
      locked: !!t.invoiceId,
      receipts: travelReceipts[t.id] ?? [],
    })),
  ]
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export interface ReceiptCoverage {
  professional: { total: number; withReceipts: number }
  travel:       { total: number; withReceipts: number }
}

export function summariseCoverage(rows: LedgerRow[]): ReceiptCoverage {
  const cover: ReceiptCoverage = {
    professional: { total: 0, withReceipts: 0 },
    travel:       { total: 0, withReceipts: 0 },
  }
  for (const r of rows) {
    const bucket = r.kind === 'professional_expense' ? cover.professional : cover.travel
    bucket.total += 1
    if (r.receipts.length > 0) bucket.withReceipts += 1
  }
  return cover
}
