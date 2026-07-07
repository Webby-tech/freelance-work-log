export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getEntries } from '@/lib/db/queries/entries'
import { getClients } from '@/lib/db/queries/clients'
import { getCurrentTaxYear, getTaxYearForDate } from '@/lib/tax-year'
import { Button } from '@/components/ui/button'
import { EntryTable } from '@/components/work-entry/EntryTable'
import { Plus } from 'lucide-react'

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; month?: string; invoiced?: string; year?: string }>
}) {
  const params = await searchParams

  // Build list of available tax years: current + up to 3 prior
  const currentTY = getCurrentTaxYear()
  const taxYears = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(currentTY.start.getFullYear() - i, 3, 6)
    return getTaxYearForDate(d)
  })

  // Determine which tax year is selected
  const selectedYear = params.year ?? currentTY.label
  const activeTY = taxYears.find(ty => ty.label === selectedYear) ?? currentTY
  const taxYearBounds = {
    start: activeTY.start.toISOString().split('T')[0],
    end:   activeTY.end.toISOString().split('T')[0],
  }

  const [entries, clients] = await Promise.all([
    getEntries({
      clientId:      params.client,
      month:         params.month,
      taxYearBounds: params.month ? undefined : taxYearBounds,
      invoiced: params.invoiced === 'true'  ? true
               : params.invoiced === 'false' ? false
               : undefined,
    }),
    getClients(),
  ])

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Work Log</h1>
          <p className="text-sm text-slate-500 mt-1">{entries.length} entries</p>
        </div>
        <Button asChild size="sm">
          <Link href="/log/new"><Plus className="h-4 w-4 mr-1" />New entry</Link>
        </Button>
      </div>

      <EntryTable
        entries={entries}
        clients={clients}
        taxYears={taxYears.map(ty => ty.label)}
        selectedYear={selectedYear}
      />
    </div>
  )
}
