import { supabaseAdmin } from '../index'
import type { WorkEntry, Client, Invoice, Agent, Expense, TravelExpenseItem } from '../schema'
import { fromDb } from '../mappers'

export type ReportEntry   = WorkEntry & { client: Client; travelItems: TravelExpenseItem[] }
export type ReportInvoice = Invoice  & { client: Client | null; agent: Agent | null }

export interface ReportData {
  entries:  ReportEntry[]
  invoices: ReportInvoice[]
  expenses: Expense[]
}

export async function getReportData(start: string, end: string): Promise<ReportData> {
  const [entriesRes, invoicesRes, expensesRes] = await Promise.all([
    supabaseAdmin
      .from('work_entries')
      .select('*, client:clients(*)')
      .gte('date', start)
      .lte('date', end)
      .order('date'),
    supabaseAdmin
      .from('invoices')
      .select('*, client:clients(*), agent:agents(*)')
      .gte('period_start', start)
      .lte('period_start', end)
      .order('period_start'),
    supabaseAdmin
      .from('expenses')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date'),
  ])

  if (entriesRes.error) throw entriesRes.error
  if (invoicesRes.error) throw invoicesRes.error
  if (expensesRes.error) throw expensesRes.error

  const entries = (entriesRes.data as unknown[]).map(r => fromDb<WorkEntry & { client: Client }>(r))

  // Fetch travel expense items for all entries in one query
  const entryIds = entries.map(e => e.id)
  let travelItemsMap = new Map<string, TravelExpenseItem[]>()
  if (entryIds.length > 0) {
    const { data: itemsData } = await supabaseAdmin
      .from('travel_expense_items')
      .select('*')
      .in('work_entry_id', entryIds)
      .order('created_at')
    if (itemsData) {
      for (const row of itemsData as unknown[]) {
        const item = fromDb<TravelExpenseItem>(row)
        const list = travelItemsMap.get(item.workEntryId) ?? []
        list.push(item)
        travelItemsMap.set(item.workEntryId, list)
      }
    }
  }

  return {
    entries:  entries.map(e => ({ ...e, travelItems: travelItemsMap.get(e.id) ?? [] })),
    invoices: (invoicesRes.data as unknown[]).map(r => fromDb<ReportInvoice>(r)),
    expenses: (expensesRes.data as unknown[]).map(r => fromDb<Expense>(r)),
  }
}
