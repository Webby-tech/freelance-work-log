export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getEntries, getUninvoicedSummary, getYtdMiles } from '@/lib/db/queries/entries'
import { getSettings } from '@/lib/db/queries/settings'
import { getYtdExpenses, getYtdExpensesTotal, getRecentUniqueExpenses } from '@/lib/db/queries/expenses'
import { estimateTax } from '@/lib/tax-estimate'
import { getCurrentTaxYear, formatTaxYearDates, MILEAGE_RATE_STANDARD, MILEAGE_RATE_REDUCED, MILEAGE_THRESHOLD } from '@/lib/tax-year'
import { formatCurrency } from '@/lib/utils'
import { TaxEstimateCard } from '@/components/dashboard/TaxEstimateCard'
import { MonthlyCard } from '@/components/dashboard/MonthlyCard'
import { ExpenseCard } from '@/components/dashboard/ExpenseForm'
import { Button } from '@/components/ui/button'
import { Plus, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default async function DashboardPage() {
  const [settings, entries, uninvoiced, ytdMiles, ytdExpensesList, ytdExpensesTotal, recentExpenses] = await Promise.all([
    getSettings(),
    getEntries({ taxYear: true }),
    getUninvoicedSummary(),
    getYtdMiles(),
    getYtdExpenses(),
    getYtdExpensesTotal(),
    getRecentUniqueExpenses(),
  ])

  const taxYear = getCurrentTaxYear()

  if (!settings) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-3">
          <p className="font-medium text-amber-800">Welcome! Let's get you set up.</p>
          <p className="text-sm text-amber-700">Complete your settings to start logging work and generating invoices.</p>
          <Button asChild size="sm">
            <Link href="/settings">Go to Settings</Link>
          </Button>
        </div>
      </div>
    )
  }

  // YTD totals
  let ytdGrossFees        = 0
  let ytdMileageClaim     = 0
  let ytdTravelExpenses   = 0
  let ytdAgentCommission  = 0
  let runningMiles        = 0

  // Monthly breakdown
  const monthMap = new Map<string, { grossFees: number; mileageClaim: number; travelExpenses: number; count: number }>()

  for (const e of entries) {
    const fee   = Number(e.flatFee)
    const miles = e.returnMiles ?? 0
    const tavel = Number(e.travelExpenses ?? 0)

    // HMRC mileage rate with 10k threshold
    const rate = runningMiles >= MILEAGE_THRESHOLD ? MILEAGE_RATE_REDUCED : MILEAGE_RATE_STANDARD
    const standardMiles = Math.min(miles, Math.max(0, MILEAGE_THRESHOLD - runningMiles))
    const reducedMiles  = miles - standardMiles
    const mileValue     = standardMiles * MILEAGE_RATE_STANDARD + reducedMiles * MILEAGE_RATE_REDUCED
    runningMiles += miles

    ytdGrossFees      += fee
    ytdMileageClaim   += mileValue
    ytdTravelExpenses += tavel

    // Monthly grouping
    const monthKey = e.date.slice(0, 7)
    const mEntry = monthMap.get(monthKey) ?? { grossFees: 0, mileageClaim: 0, travelExpenses: 0, count: 0 }
    mEntry.grossFees      += fee
    mEntry.mileageClaim   += mileValue
    mEntry.travelExpenses += tavel
    mEntry.count          += 1
    monthMap.set(monthKey, mEntry)
  }

  const ytdAllowableExpenses = ytdMileageClaim + ytdTravelExpenses + ytdAgentCommission + ytdExpensesTotal

  const estimate = estimateTax({
    ytdGrossFees,
    ytdAllowableExpenses,
    personalAllowanceExhausted: settings.personalAllowanceExhausted ?? true,
    useFlatRate:                settings.useFlatTaxRate ?? false,
    flatRateOverride:           Number(settings.flatTaxRateOverride ?? 0.20),
  })

  const months = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      key,
      label: format(parseISO(`${key}-01`), 'MMMM yyyy'),
      ...data,
    }))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">{formatTaxYearDates(taxYear)}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/log/new"><Plus className="h-4 w-4 mr-1" />Log work</Link>
        </Button>
      </div>

      {/* Uninvoiced banner */}
      {uninvoiced.count > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 text-sm text-amber-800">
            <span className="font-medium">{uninvoiced.count} uninvoiced {uninvoiced.count === 1 ? 'entry' : 'entries'}</span>
            {' '}({formatCurrency(uninvoiced.totalFees)} in fees)
          </div>
          <Button asChild size="sm" variant="outline" className="text-amber-800 border-amber-300">
            <Link href="/invoices/generate">Generate invoice</Link>
          </Button>
        </div>
      )}

      {/* YTD summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile
          label="Gross fees"
          value={formatCurrency(ytdGrossFees)}
          sub={uninvoiced.totalFees > 0 ? `Includes ${formatCurrency(uninvoiced.totalFees)} uninvoiced` : undefined}
        />
        <SummaryTile
          label="Mileage claim"
          value={formatCurrency(ytdMileageClaim)}
          sub={uninvoiced.totalMileage > 0 ? `Includes ${formatCurrency(uninvoiced.totalMileage)} not yet recorded` : undefined}
        />
        <SummaryTile label="Travel expenses" value={formatCurrency(ytdTravelExpenses)} />
        <SummaryTile
          label="YTD miles"
          value={`${ytdMiles} mi`}
          sub={ytdMiles >= MILEAGE_THRESHOLD ? '25p rate active' : `${MILEAGE_THRESHOLD - ytdMiles} mi remaining at 45p`}
        />
      </div>

      {/* Tax estimate */}
      <TaxEstimateCard
        estimate={estimate}
        ytdGrossFees={ytdGrossFees}
        ytdMileageClaim={ytdMileageClaim}
        ytdTravelExpenses={ytdTravelExpenses}
        ytdAgentCommission={ytdAgentCommission}
        ytdGeneralExpenses={ytdExpensesTotal}
        ytdAllowableExpenses={ytdAllowableExpenses}
        priorYearTaxBill={settings.priorYearTaxBill ? Number(settings.priorYearTaxBill) : null}
        poaJanPaid={Number(settings.poaJanPaid ?? 0)}
        poaJulPaid={Number(settings.poaJulPaid ?? 0)}
        useFlatRate={settings.useFlatTaxRate ?? false}
      />

      {/* General expenses */}
      <ExpenseCard expenses={ytdExpensesList} ytdTotal={ytdExpensesTotal} recentItems={recentExpenses} />

      {/* Monthly breakdown */}
      {months.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {months.map(m => (
              <MonthlyCard
                key={m.key}
                month={m.label}
                grossFees={m.grossFees}
                mileageClaim={m.mileageClaim}
                travelExpenses={m.travelExpenses}
                entryCount={m.count}
              />
            ))}
          </div>
        </section>
      )}

      {entries.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">No work logged yet this tax year.</p>
          <Button asChild className="mt-3" size="sm" variant="outline">
            <Link href="/log/new">Log your first entry</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
