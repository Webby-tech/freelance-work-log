export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getInvoices } from '@/lib/db/queries/invoices'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { taxYearCode } from '@/lib/invoicing'
import { Plus, FileText } from 'lucide-react'
import { InvoiceStatusActions } from './InvoiceStatusActions'

const statusColour: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-700 border-slate-200',
  sent:    'bg-blue-50 text-blue-700 border-blue-200',
  paid:    'bg-green-50 text-green-700 border-green-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  voided:  'bg-slate-50 text-slate-400 border-slate-100',
}

function taxYearLabel(code: string): string {
  // "2627" → "Tax Year 2026/27"
  return `Tax Year 20${code.slice(0, 2)}/20${code.slice(2)}`
}

export default async function InvoicesPage() {
  const invoices = await getInvoices()

  // Group invoices by tax year, newest year first
  const grouped = new Map<string, typeof invoices>()
  for (const inv of invoices) {
    const code = taxYearCode(inv.periodStart)
    if (!grouped.has(code)) grouped.set(code, [])
    grouped.get(code)!.push(inv)
  }
  const sortedYears = [...grouped.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/invoices/generate"><Plus className="h-4 w-4 mr-1" />Generate</Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No invoices yet. Log work entries and generate your first invoice.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedYears.map(yearCode => (
            <div key={yearCode}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {taxYearLabel(yearCode)}
              </h2>
              <div className="space-y-2">
                {grouped.get(yearCode)!.map(inv => (
                  <Card key={inv.id} className={inv.status === 'voided' ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="font-medium text-sm hover:underline"
                            >
                              {inv.invoiceNumber}
                            </Link>
                            <Badge className={`text-xs ${statusColour[inv.status] ?? ''}`}>
                              {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {inv.type === 'agent_commission' ? 'Agent commission' : 'Client invoice'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {inv.client?.name ?? inv.agent?.name ?? '—'} · Issued {formatDate(inv.issuedDate)}
                            {inv.dueDate && ` · Due ${formatDate(inv.dueDate)}`}
                          </p>
                          <p className="text-xs text-slate-600 mt-1 font-medium">{formatCurrency(Number(inv.total))}</p>
                        </div>
                        {inv.status !== 'voided' && (
                          <InvoiceStatusActions invoiceId={inv.id} currentStatus={inv.status} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
