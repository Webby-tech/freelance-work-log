export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getCurrentTaxYear, getTaxYearForDate } from '@/lib/tax-year'
import { getExpenseLedger, summariseCoverage } from '@/lib/db/queries/receipts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ReceiptAttachments } from '@/components/receipts/ReceiptAttachments'
import { ReceiptBadge } from '@/components/receipts/ReceiptBadge'

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; filter?: string }>
}) {
  const params = await searchParams

  // Current tax year + 3 prior (same as Reports)
  const currentTY = getCurrentTaxYear()
  const taxYears = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(currentTY.start.getFullYear() - i, 3, 6)
    return getTaxYearForDate(d)
  })
  const activeTY = taxYears.find(ty => ty.label === params.year) ?? currentTY
  const onlyMissing = params.filter === 'missing'

  const start = activeTY.start.toISOString().split('T')[0]
  const end   = activeTY.end.toISOString().split('T')[0]

  const rows = await getExpenseLedger(start, end)
  const missing = rows.filter(r => r.receipts.length === 0)
  const shown = onlyMissing ? missing : rows
  const cover = summariseCoverage(rows)

  const href = (over: { year?: string; filter?: string }) => {
    const p = new URLSearchParams()
    const year = over.year ?? activeTY.label
    const filter = 'filter' in over ? over.filter : params.filter
    p.set('year', year)
    if (filter) p.set('filter', filter)
    return `/receipts?${p.toString()}`
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Evidence for every item of expenditure you claim — professional expenses and travel expenses.
        </p>
      </div>

      {/* Tax year selector */}
      <div className="flex gap-2 flex-wrap">
        {taxYears.map(ty => (
          <Link
            key={ty.label}
            href={href({ year: ty.label })}
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

      {/* Coverage */}
      <Card>
        <CardContent className="p-4 text-sm space-y-1" data-testid="receipt-coverage">
          <div className="flex justify-between">
            <span className="text-slate-600">Professional expenses</span>
            <span>{cover.professional.withReceipts} of {cover.professional.total} have a receipt</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Travel expenses</span>
            <span>{cover.travel.withReceipts} of {cover.travel.total} have a receipt</span>
          </div>
          <p className="pt-1 text-xs text-slate-400">
            HMRC generally expects business records to be kept for five years after the 31 January filing deadline
            for the tax year. This isn&apos;t tax advice — confirm retention requirements with your accountant.
          </p>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex gap-2">
        <Link
          href={href({ filter: undefined })}
          className={`px-3 py-1.5 rounded-md text-sm border ${!onlyMissing ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
        >
          All ({rows.length})
        </Link>
        <Link
          href={href({ filter: 'missing' })}
          className={`px-3 py-1.5 rounded-md text-sm border ${onlyMissing ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
        >
          Missing receipts ({missing.length})
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border rounded-lg">
          <p className="text-sm">
            {onlyMissing && rows.length > 0
              ? 'Every expense for this tax year has a receipt attached.'
              : 'No expenses recorded for this tax year.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="receipt-rows">
          {shown.map(r => (
            <Card key={`${r.kind}-${r.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(r.date)} · {r.kind === 'professional_expense' ? 'Expense' : 'Travel'} · {r.detail}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.reimbursed && <Badge variant="outline" className="text-xs">Reimbursed by client</Badge>}
                      {r.locked && <Badge variant="outline" className="text-xs">Invoiced</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium">{formatCurrency(r.amount)}</span>
                    <ReceiptBadge count={r.receipts.length} />
                  </div>
                </div>
                <ReceiptAttachments
                  parentType={r.kind}
                  parentId={r.id}
                  receipts={r.receipts}
                  canDelete={!r.locked}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
