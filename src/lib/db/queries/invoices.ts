import { supabaseAdmin } from '../index'
import type { Invoice, NewInvoice, Client, Agent, WorkEntry } from '../schema'
import { fromDb, toDb } from '../mappers'

export type InvoiceWithRelations = Invoice & { client: Client | null; agent: Agent | null }

export async function getInvoices(): Promise<InvoiceWithRelations[]> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, client:clients(*), agent:agents(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown[]).map(row => fromDb<InvoiceWithRelations>(row))
}

export async function getInvoice(id: string): Promise<InvoiceWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, client:clients(*), agent:agents(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return fromDb<InvoiceWithRelations>(data)
}

export async function getInvoiceWithEntries(
  id: string
): Promise<(InvoiceWithRelations & { entries: WorkEntry[] }) | null> {
  const invoice = await getInvoice(id)
  if (!invoice) return null
  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .select('*')
    .eq('invoice_id', id)
    .order('date')
  if (error) throw error
  return { ...invoice, entries: (data as unknown[]).map(row => fromDb<WorkEntry>(row)) }
}

export async function createInvoice(
  values: Omit<NewInvoice, 'id' | 'createdAt' | 'updatedAt'>,
  entryIds: string[]
): Promise<Invoice> {
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .insert(toDb(values))
    .select()
    .single()
  if (invErr) throw invErr

  const { error: entryErr } = await supabaseAdmin
    .from('work_entries')
    .update({ invoice_id: invoice.id, updated_at: new Date().toISOString() })
    .in('id', entryIds)
  if (entryErr) throw entryErr

  return fromDb<Invoice>(invoice)
}

export async function updateInvoiceStatus(
  id: string,
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'voided'
): Promise<Invoice> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb<Invoice>(data)
}

export async function voidInvoice(id: string): Promise<void> {
  await updateInvoiceStatus(id, 'voided')
  const { error } = await supabaseAdmin
    .from('work_entries')
    .update({ invoice_id: null, updated_at: new Date().toISOString() })
    .eq('invoice_id', id)
  if (error) throw error
}

export async function getNextSequenceNumber(type: 'client' | 'agent', tyCode: string): Promise<number> {
  const prefix  = type === 'client' ? 'INV' : 'AGT'
  const pattern = `${prefix}-${tyCode}-%`
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', pattern)
    .order('invoice_number', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return 1
  const parts   = (data[0] as { invoice_number: string }).invoice_number.split('-')
  const lastSeq = parseInt(parts[parts.length - 1], 10)
  return isNaN(lastSeq) ? 1 : lastSeq + 1
}
