export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getCurrentTaxYear, getTaxYearForDate, formatTaxYearDates, getStandardMileageRateForTaxYear, MILEAGE_RATE_REDUCED, MILEAGE_THRESHOLD } from '@/lib/tax-year'
import { getReportData } from '@/lib/db/queries/reports'
import { getSettings } from '@/lib/db/queries/settings'
import { estimateTax } from '@/lib/tax-estimate'
import { calculateReimbursement, roundMoney } from '@/lib/reimbursement'
import { getExpenseLedger, summariseCoverage } from '@/lib/db/queries/receipts'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ReportPDFButton } from './ReportPDFButton'
import type { MonthRow, ClientRow, ReportSummary } from '@/components/reports/AnnualReportPDF'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params   = await searchParams
  const settings = await getSettings()

  // Build list of available tax years: current + 3 prior
  const currentTY = getCurrentTaxYear()
  const taxYears  = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(currentTY.start.getFullYear() - i, 3, 6)
    return getTaxYearForDate(d)
  })

  const selectedLabel = params.year ?? currentTY.label
  const activeTY      = taxYears.find(ty => ty.label === selectedLabel) ?? currentTY
  const isPartial     = activeTY.label === currentTY.label
  const standardRate  = getStandardMileageRateForTaxYear(activeTY)

  const start = activeTY.start.toISOString().split('T')[0]
  const end   = activeTY.end.toISOString().split('T')[0]

  const { entries, invoices, expenses } = await getReportData(start, end)
  // Evidence check: how many claimed expenses (professional + travel items) have a receipt
  const receiptCoverage = summariseCoverage(await getExpenseLedger(start, end))
  const receiptsTotal = receiptCoverage.professional.total + receiptCoverage.travel.total
  const receiptsMissing = receiptsTotal - receiptCoverage.professional.withReceipts - receiptCoverage.travel.withReceipts

  // ── Compute summary ───────────────────────────────────────────────────────
  let grossFees      = 0
  let mileageClaim   = 0
  let travelExpenses = 0
  let reimbursedExpenses = 0
  let runningMiles   = 0

  const monthMap      = new Map<string, MonthRow>()
  const clientMap     = new Map<string, ClientRow>()
  const entryMileage  = new Map<string, { miles: number; value: number; rate: number }>()
  const entryReimbursed = new Map<string, number>()

  for (const e of entries) {
    const fee   = Number(e.flatFee)
    const miles = e.returnMiles ?? 0
    // Travel that counts as an expense = all travel minus the part reimbursed by the client
    // (a pass-through: income and expense cancel, so it's excluded from both).
    const reimb = calculateReimbursement(e.travelItems, e.travelReimbursementCap)
    const trav  = reimb.billable > 0
      ? roundMoney(Number(e.travelExpenses ?? 0) - reimb.billable)
      : Number(e.travelExpenses ?? 0)
    if (reimb.billable > 0) {
      reimbursedExpenses += reimb.billable
      entryReimbursed.set(e.id, reimb.billable)
    }

    // Mileage value with 10k threshold
    const standardMiles = Math.min(miles, Math.max(0, MILEAGE_THRESHOLD - runningMiles))
    const reducedMiles  = miles - standardMiles
    const mileValue     = standardMiles * standardRate + reducedMiles * MILEAGE_RATE_REDUCED
    runningMiles += miles

    grossFees      += fee
    mileageClaim   += mileValue
    travelExpenses += trav

    // Store per-entry mileage for travel section
    if (miles > 0) {
      const rate = reducedMiles > 0 ? MILEAGE_RATE_REDUCED : standardRate
      entryMileage.set(e.id, { miles, value: mileValue, rate })
    }

    // Monthly grouping
    const mk    = e.date.slice(0, 7)
    const mLabel = format(parseISO(`${mk}-01`), 'MMMM yyyy')
    const mRow   = monthMap.get(mk) ?? { key: mk, label: mLabel, grossFees: 0, mileageClaim: 0, travelExpenses: 0, count: 0 }
    mRow.grossFees      += fee
    mRow.mileageClaim   += mileValue
    mRow.travelExpenses += trav
    mRow.count          += 1
    monthMap.set(mk, mRow)

    // Client grouping
    const cn   = e.client.name
    const cRow = clientMap.get(cn) ?? { name: cn, type: e.client.type, grossFees: 0, mileageClaim: 0, travelExpenses: 0, count: 0 }
    cRow.grossFees      += fee
    cRow.mileageClaim   += mileValue
    cRow.travelExpenses += trav
    cRow.count          += 1
    clientMap.set(cn, cRow)
  }

  // Agent commission from payroll invoices
  const agentCommission = invoices
    .filter(inv => inv.type === 'agent_commission')
    .reduce((s, inv) => s + Number(inv.commissionAmt ?? 0), 0)

  // General expenses
  const generalExpenses = expenses.reduce((s, exp) => s + Number(exp.amount), 0)

  const totalAllowableExpenses = mileageClaim + travelExpenses + agentCommission + generalExpenses
  const taxableProfit          = Math.max(0, grossFees - totalAllowableExpenses)

  const estimate = estimateTax({
    ytdGrossFees:               grossFees,
    ytdAllowableExpenses:       totalAllowableExpenses,
    personalAllowanceExhausted: settings?.personalAllowanceExhausted ?? true,
    useFlatRate:                settings?.useFlatTaxRate ?? false,
    flatRateOverride:           Number(settings?.flatTaxRateOverride ?? 0.20),
  })

  const summary: ReportSummary = {
    grossFees,
    mileageClaim,
    totalReturnMiles: runningMiles,
    travelExpenses,
    reimbursedExpenses,
    receiptCoverage,
    agentCommission,
    generalExpenses,
    totalAllowableExpenses,
    taxableProfit,
    estimatedTax:   estimate.estimatedTax,
    taxRate:        estimate.marginalRate,
    higherRateBand: estimate.inHigherBand,
  }

  const byMonth  = Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  const byClient = Array.from(clientMap.values()).sort((a, b) => b.grossFees - a.grossFees)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Annual Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">{formatTaxYearDates(activeTY)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isPartial && <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Year in progress</Badge>}
          {settings && (
            <ReportPDFButton
              taxYear={activeTY}
              isPartial={isPartial}
              entries={entries}
              invoices={invoices}
              expenses={expenses}
              settings={settings}
              summary={summary}
              byMonth={byMonth}
              byClient={byClient}
            />
          )}
        </div>
      </div>

      {/* Tax year selector */}
      <div className="flex gap-2 flex-wrap">
        {taxYears.map(ty => (
          <Link
            key={ty.label}
            href={`/reports?year=${encodeURIComponent(ty.label)}`}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              ty.label === activeTY.label
                ? 'bg-slate-900 text-white border-slate-900'
                : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            {ty.label.replace('/', '/20')}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border rounded-lg">
          <p className="text-sm">No work entries recorded for this tax year.</p>
        </div>
      ) : (
        <>
          {/* ── Income & Expenses summary ── */}
          <section className="rounded-lg border bg-white overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b">
              <h2 className="text-sm font-semibold text-slate-700">Income &amp; Allowable Expenses</h2>
            </div>
            <div className="divide-y">
              <SummaryRow label="Gross fees" value={formatCurrency(grossFees)} />
              <SummaryRow
                label={`Mileage claim (${runningMiles} mi at HMRC rate)`}
                value={formatCurrency(mileageClaim)}
                sub={runningMiles > MILEAGE_THRESHOLD ? `Includes miles at reduced 25p rate` : undefined}
              />
              <SummaryRow label="Travel expenses" value={formatCurrency(travelExpenses)} />
              {agentCommission > 0 && (
                <SummaryRow label="Agent commission paid" value={formatCurrency(agentCommission)} />
              )}
              {generalExpenses > 0 && (
                <SummaryRow label="General business expenses" value={formatCurrency(generalExpenses)} />
              )}
              <SummaryRow label="Total allowable expenses" value={formatCurrency(totalAllowableExpenses)} bold />
              <div className="px-5 py-3 bg-slate-900 flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Taxable profit</span>
                <span className="text-sm font-bold text-white">{formatCurrency(taxableProfit)}</span>
              </div>
              <SummaryRow
                label={`Estimated income tax @ ${Math.round(estimate.marginalRate * 100)}%`}
                value={formatCurrency(estimate.estimatedTax)}
                highlight
              />
            </div>
            {summary.higherRateBand && (
              <div className="mx-5 mb-4 mt-0 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs text-amber-800 font-medium">Taxable profit exceeds £37,700 — some income will be taxed at 40%.</p>
              </div>
            )}
            <p className="px-5 pb-4 text-xs text-slate-400 italic">
              Personal allowance used by pension income — acting income taxable from £1. No NI (age 67).
            </p>
            {reimbursedExpenses > 0 && (
              <div className="border-t bg-slate-50 px-5 py-3 space-y-1" data-testid="reimbursed-summary">
                <p className="text-xs font-semibold text-slate-600">Reimbursed expenses (billed to clients at cost)</p>
                <SummaryRow label="Reimbursed expenses" value={formatCurrency(reimbursedExpenses)} bold />
                <SummaryRow label="Turnover for Self Assessment (fees + reimbursed)" value={formatCurrency(grossFees + reimbursedExpenses)} />
                <SummaryRow label="Expenses for Self Assessment (allowable + reimbursed)" value={formatCurrency(totalAllowableExpenses + reimbursedExpenses)} />
                <p className="text-xs text-slate-400 italic pt-1">
                  Reimbursed travel is income and an expense that cancel out, so it is excluded from taxable profit above.
                  A Self Assessment return normally reports both figures gross — confirm the treatment with your accountant before filing.
                </p>
              </div>
            )}
          </section>

          {/* ── Receipts (evidence for expenses) ── */}
          {receiptsTotal > 0 && (
            <section className="rounded-lg border bg-white overflow-hidden" data-testid="receipt-summary">
              <div className="px-5 py-3 bg-slate-50 border-b">
                <h2 className="text-sm font-semibold text-slate-700">Receipts for expenses</h2>
              </div>
              <div className="divide-y">
                <SummaryRow
                  label="Professional expenses"
                  value={`${receiptCoverage.professional.withReceipts} with · ${receiptCoverage.professional.total - receiptCoverage.professional.withReceipts} without`}
                />
                <SummaryRow
                  label="Travel expenses"
                  value={`${receiptCoverage.travel.withReceipts} with · ${receiptCoverage.travel.total - receiptCoverage.travel.withReceipts} without`}
                />
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className={`text-sm font-semibold ${receiptsMissing > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {receiptsMissing > 0
                      ? `${receiptsMissing} of ${receiptsTotal} expenses have no receipt`
                      : `All ${receiptsTotal} expenses have a receipt`}
                  </span>
                  {receiptsMissing > 0 && (
                    <Link href={`/receipts?year=${encodeURIComponent(activeTY.label)}&filter=missing`} className="text-xs text-blue-600 hover:underline">
                      Find missing receipts →
                    </Link>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Monthly breakdown ── */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly Breakdown</h2>
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Month</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Jobs</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Gross fees</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Mileage</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Travel</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byMonth.map(m => (
                    <tr key={m.key} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium">{m.label}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{m.count}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(m.grossFees)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(m.mileageClaim)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(m.travelExpenses)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t font-semibold">
                  <tr>
                    <td className="px-4 py-2.5 text-xs text-slate-500">Total</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500">{entries.length}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(grossFees)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(mileageClaim)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(travelExpenses)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ── Client breakdown ── */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">By Client</h2>
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Client</th>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Type</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Jobs</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Gross fees</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byClient.map(cl => (
                    <tr key={cl.name} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium">{cl.name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs capitalize">{cl.type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{cl.count}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(cl.grossFees)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Invoice register ── */}
          {invoices.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Invoice Register</h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Invoice</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Issued</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Client / Agent</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Type</th>
                      <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Amount</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map(inv => {
                      const isCommission = inv.type === 'agent_commission'
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <Link href={`/invoices/${inv.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                              {inv.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">
                            {format(parseISO(inv.issuedDate), 'd MMM yyyy')}
                          </td>
                          <td className="px-4 py-2.5">{inv.client?.name ?? inv.agent?.name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {isCommission
                              ? <span className="text-red-600 font-medium">Commission out</span>
                              : <span className="text-green-700">Income</span>}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-medium ${isCommission ? 'text-red-600' : ''}`}>
                            {isCommission ? `(${formatCurrency(Number(inv.total))})` : formatCurrency(Number(inv.total))}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={inv.status} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-slate-400 italic mt-2 px-1">
                  Amounts in (brackets) in red are outgoing commission payments, not income.
                  Payroll client income (e.g. PNP Events) is paid gross by the payroll company with no tax deducted at source — no invoice is raised by me, hence it does not appear here.
                </p>
              </div>
            </section>
          )}

          {/* ── Travel & Mileage breakdown ── */}
          {(() => {
            type TravelRow = { key: string; date: string; job: string; description: string; amount: number; isMileage?: boolean }
            const travelRows: TravelRow[] = []
            for (const e of entries) {
              const hasMileage = (e.returnMiles ?? 0) > 0
              const hasTravelExpenses = Number(e.travelExpenses ?? 0) > 0
              if (!hasMileage && !hasTravelExpenses) continue

              const job     = `${e.locationName}${e.details ? ` — ${e.details}` : ''}`
              const dateStr = format(parseISO(e.date), 'd MMM yyyy')
              let firstRow  = true

              // Mileage row first
              if (hasMileage) {
                const m = entryMileage.get(e.id)!
                const ratePence = Math.round(m.rate * 100)
                travelRows.push({
                  key: `${e.id}-mileage`,
                  date: dateStr,
                  job,
                  description: `Mileage — ${m.miles} mi @ ${ratePence}p/mi`,
                  amount: m.value,
                  isMileage: true,
                })
                firstRow = false
              }

              // Travel expense items
              if (hasTravelExpenses) {
                if (e.travelItems && e.travelItems.length > 0) {
                  e.travelItems.forEach((item, idx) => {
                    travelRows.push({
                      key: `${e.id}-t${idx}`,
                      date: firstRow && idx === 0 ? dateStr : '',
                      job:  firstRow && idx === 0 ? job : '',
                      description: item.reimbursed ? `${item.description} (reimbursed by client)` : item.description,
                      amount: Number(item.amount),
                    })
                    firstRow = false
                  })
                } else {
                  travelRows.push({
                    key: `${e.id}-travel`,
                    date: firstRow ? dateStr : '',
                    job:  firstRow ? job : '',
                    description: 'Travel expenses',
                    amount: Number(e.travelExpenses),
                  })
                }
                // Pass-through: taken back out so the table reconciles to the allowable travel total
                const passThrough = entryReimbursed.get(e.id)
                if (passThrough) {
                  travelRows.push({
                    key: `${e.id}-reimbursed`,
                    date: '',
                    job: '',
                    description: 'Less: reimbursed by client (excluded)',
                    amount: -passThrough,
                  })
                }
              }
            }
            if (travelRows.length === 0) return null
            const totalTravel = mileageClaim + travelExpenses
            return (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Travel &amp; Mileage</h2>
                <div className="rounded-lg border bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Job</th>
                        <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Description</th>
                        <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {travelRows.map(row => (
                        <tr key={row.key} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{row.date}</td>
                          <td className="px-4 py-2.5">{row.job}</td>
                          <td className={`px-4 py-2.5 ${row.isMileage ? 'text-slate-500 italic' : 'text-slate-600'}`}>{row.description}</td>
                          <td className="px-4 py-2.5 text-right">{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t font-semibold">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5 text-xs text-slate-500">Total</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(totalTravel)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )
          })()}

          {/* ── General expenses ── */}
          {expenses.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">General Business Expenses</h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Category</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Description</th>
                      <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{format(parseISO(exp.date), 'd MMM yyyy')}</td>
                        <td className="px-4 py-2.5 text-slate-600">{exp.category}</td>
                        <td className="px-4 py-2.5">{exp.description}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(Number(exp.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t font-semibold">
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 text-xs text-slate-500">Total</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(generalExpenses)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SummaryRow({ label, value, sub, bold, highlight }: {
  label: string; value: string; sub?: string; bold?: boolean; highlight?: boolean
}) {
  return (
    <div className={`px-5 py-3 flex justify-between items-start ${highlight ? 'bg-amber-50' : ''}`}>
      <div>
        <span className={`text-sm ${bold ? 'font-semibold' : 'text-slate-600'}`}>{label}</span>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-sm ml-4 shrink-0 ${bold ? 'font-semibold' : ''} ${highlight ? 'text-amber-700 font-semibold' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:    'bg-green-100 text-green-800',
    sent:    'bg-blue-100 text-blue-800',
    draft:   'bg-slate-100 text-slate-600',
    overdue: 'bg-red-100 text-red-700',
    voided:  'bg-slate-100 text-slate-400 line-through',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}
