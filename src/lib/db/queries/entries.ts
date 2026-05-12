import { supabaseAdmin } from '../index'
import type { WorkEntry, NewWorkEntry, Client } from '../schema'
import { getCurrentTaxYear } from '../../tax-year'
import { fromDb, toDb } from '../mappers'

export type WorkEntryWithClient = WorkEntry & { client: Client }

export interface EntryFilters {
  clientId?: string
  month?: string       // 'YYYY-MM'
  taxYear?: boolean    // if true, filter to current tax year
  taxYearBounds?: { start: string; end: string }  // explicit bounds for any tax year
  invoiced?: boolean   // if true, only invoiced; if false, only uninvoiced
}

export async function getEntries(filters: EntryFilters = {}): Promise<WorkEntryWithClient[]> {
  let query = supabaseAdmin
    .from('work_entries')
    .select('*, client:clients(*)')
    .order('date', { ascending: false })

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId)
  }
  if (filters.month) {
    query = query
      .gte('date', `${filters.month}-01`)
      .lte('date', `${filters.month}-31`)
  } else if (filters.taxYearBounds) {
    query = query
      .gte('date', filters.taxYearBounds.start)
      .lte('date', filters.taxYearBounds.end)
  } else if (filters.taxYear) {
    const { start, end } = getCurrentTaxYear()
    query = query
      .gte('date', start.toISOString().split('T')[0])
      .lte('date', end.toISOString().split('T')[0])
  }
  if (filters.invoiced === true) {
    query = query.not('invoice_id', 'is', null)
  } else if (filters.invoiced === false) {
    query = query.is('invoice_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as unknown[]).map(row => fromDb<WorkEntryWithClient>(row))
}

export async function getEntry(id: string): Promise<WorkEntryWithClient | null> {
  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .select('*, client:clients(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return fromDb<WorkEntryWithClient>(data)
}

export async function createEntry(
  values: Omit<NewWorkEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WorkEntry> {
  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .insert(toDb(values))
    .select()
    .single()
  if (error) throw error
  return fromDb<WorkEntry>(data)
}

export async function updateEntry(id: string, values: Partial<WorkEntry>): Promise<WorkEntry> {
  const dbValues = toDb(values) as Record<string, unknown>
  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .update({ ...dbValues, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb<WorkEntry>(data)
}

export async function deleteEntry(id: string): Promise<void> {
  const entry = await getEntry(id)
  if (entry?.invoiceId) {
    throw new Error('Cannot delete an invoiced entry. Void the invoice first.')
  }
  const { error } = await supabaseAdmin
    .from('work_entries')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getYtdMiles(): Promise<number> {
  const { start, end } = getCurrentTaxYear()
  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .select('return_miles')
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])
  if (error) throw error
  return (data as { return_miles: number | null }[])
    .reduce((sum, e) => sum + (e.return_miles ?? 0), 0)
}

export async function getUninvoicedSummary(): Promise<{ count: number; totalFees: number; totalMileage: number }> {
  const { start, end } = getCurrentTaxYear()
  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .select('flat_fee, return_miles, mileage_rate')
    .is('invoice_id', null)
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])
  if (error) throw error
  let totalFees = 0
  let totalMileage = 0
  for (const e of data as { flat_fee: string; return_miles: number | null; mileage_rate: string | null }[]) {
    totalFees += Number(e.flat_fee)
    totalMileage += (e.return_miles ?? 0) * Number(e.mileage_rate ?? 0.45)
  }
  return { count: data.length, totalFees, totalMileage }
}
