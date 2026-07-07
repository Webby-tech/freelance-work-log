import { desc, eq, inArray, like } from 'drizzle-orm'
import { db } from '../index'
import { invoices, workEntries } from '../schema'
import type { Invoice, NewInvoice, Client, Agent, WorkEntry } from '../schema'

export type InvoiceWithRelations = Invoice & { client: Client | null; agent: Agent | null }

export async function getInvoices(): Promise<InvoiceWithRelations[]> {
  return db.query.invoices.findMany({
    orderBy: desc(invoices.createdAt),
    with: { client: true, agent: true },
  })
}

export async function getInvoice(id: string): Promise<InvoiceWithRelations | null> {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: { client: true, agent: true },
  })
  return invoice ?? null
}

export async function getInvoiceWithEntries(
  id: string
): Promise<(InvoiceWithRelations & { entries: WorkEntry[] }) | null> {
  const invoice = await getInvoice(id)
  if (!invoice) return null
  const entries = await db
    .select()
    .from(workEntries)
    .where(eq(workEntries.invoiceId, id))
    .orderBy(workEntries.date)
  return { ...invoice, entries }
}

export async function createInvoice(
  values: Omit<NewInvoice, 'id' | 'createdAt' | 'updatedAt'>,
  entryIds: string[]
): Promise<Invoice> {
  return db.transaction(async (tx) => {
    const [invoice] = await tx.insert(invoices).values(values).returning()
    await tx
      .update(workEntries)
      .set({ invoiceId: invoice.id, updatedAt: new Date() })
      .where(inArray(workEntries.id, entryIds))
    return invoice
  })
}

export async function updateInvoiceStatus(
  id: string,
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'voided'
): Promise<Invoice> {
  const [invoice] = await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning()
  return invoice
}

export async function voidInvoice(id: string): Promise<void> {
  await updateInvoiceStatus(id, 'voided')
  await db
    .update(workEntries)
    .set({ invoiceId: null, updatedAt: new Date() })
    .where(eq(workEntries.invoiceId, id))
}

export async function getNextSequenceNumber(type: 'client' | 'agent', tyCode: string): Promise<number> {
  const prefix  = type === 'client' ? 'INV' : 'AGT'
  const pattern = `${prefix}-${tyCode}-%`
  const rows = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(like(invoices.invoiceNumber, pattern))
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1)
  if (rows.length === 0) return 1
  const parts   = rows[0].invoiceNumber.split('-')
  const lastSeq = parseInt(parts[parts.length - 1], 10)
  return isNaN(lastSeq) ? 1 : lastSeq + 1
}
