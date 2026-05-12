'use server'
import { revalidatePath } from 'next/cache'
import {
  createInvoice,
  updateInvoiceStatus,
  voidInvoice,
  getNextSequenceNumber,
} from '@/lib/db/queries/invoices'
import { generateInvoiceNumber, taxYearCode } from '@/lib/invoicing'
import type { NewInvoice } from '@/lib/db/schema'
import { getSettings } from '@/lib/db/queries/settings'

export async function createInvoiceAction(
  values: Omit<NewInvoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>,
  entryIds: string[]
) {
  const settings    = await getSettings()
  const prefix      = settings?.invoicePrefix ?? 'INV'
  const type        = values.type === 'client' ? 'client' : 'agent'
  const tyCode      = taxYearCode(values.periodStart)
  const seq         = await getNextSequenceNumber(type, tyCode)
  const invoiceNumber = generateInvoiceNumber(type, seq, prefix, values.periodStart)

  const invoice = await createInvoice({ ...values, invoiceNumber }, entryIds)
  revalidatePath('/invoices')
  revalidatePath('/log')
  revalidatePath('/')
  return invoice
}

export async function markInvoiceSentAction(id: string) {
  await updateInvoiceStatus(id, 'sent')
  revalidatePath('/invoices')
}

export async function markInvoicePaidAction(id: string) {
  await updateInvoiceStatus(id, 'paid')
  revalidatePath('/invoices')
}

export async function markInvoiceOverdueAction(id: string) {
  await updateInvoiceStatus(id, 'overdue')
  revalidatePath('/invoices')
}

export async function voidInvoiceAction(id: string) {
  await voidInvoice(id)
  revalidatePath('/invoices')
  revalidatePath('/log')
  revalidatePath('/')
}
