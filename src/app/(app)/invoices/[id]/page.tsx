export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceWithEntries } from '@/lib/db/queries/invoices'
import { getSettings } from '@/lib/db/queries/settings'
import { formatCurrency, formatDate, formatDateRange } from '@/lib/utils'
import { calculateInvoiceTotals } from '@/lib/invoicing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { InvoiceStatusActions } from '../InvoiceStatusActions'
import { InvoicePDFButton } from './InvoicePDFButton'
import type { WorkEntry } from '@/lib/db/schema'

const statusColour: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-700',
  sent:    'bg-blue-50 text-blue-700',
  paid:    'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
  voided:  'bg-slate-50 text-slate-400',
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [invoice, settings] = await Promise.all([
    getInvoiceWithEntries(id),
    getSettings(),
  ])
  if (!invoice) notFound()

  const commissionRate = invoice.agent
    ? Number((invoice.agent as any).commission_rate ?? 0.125)
    : 0.125

  const totals = invoice.entries.length > 0
    ? calculateInvoiceTotals(invoice.entries as WorkEntry[], commissionRate)
    : null

  const isPayroll = invoice.type === 'agent_commission'

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <Badge className={statusColour[invoice.status]}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {isPayroll ? 'Commission deduction (money owed to agent)' : 'Client invoice (money owed to you)'}
            {' · '}Issued {formatDate(invoice.issuedDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {settings && <InvoicePDFButton invoice={invoice} settings={settings} entries={invoice.entries as WorkEntry[]} />}
          {invoice.status !== 'voided' && (
            <InvoiceStatusActions invoiceId={invoice.id} currentStatus={invoice.status} />
          )}
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">{isPayroll ? 'Agent (sender)' : 'From'}</p>
            {isPayroll ? (
              <>
                <p className="font-medium">{invoice.agent?.name ?? '—'}</p>
                {invoice.agent?.address && <p className="text-slate-500 text-xs mt-0.5 whitespace-pre-line">{invoice.agent.address}</p>}
                {invoice.agent?.email   && <p className="text-slate-500 text-xs mt-0.5">Email: {invoice.agent.email}</p>}
              </>
            ) : (
              <>
                <p className="font-medium">{settings?.legalName ?? settings?.tradingName ?? 'You'}</p>
                {settings?.address && <p className="text-slate-500 text-xs mt-0.5 whitespace-pre-line">{settings.address}</p>}
                {settings?.phone   && <p className="text-slate-500 text-xs mt-0.5">Tel: {settings.phone}</p>}
                {settings?.email   && <p className="text-slate-500 text-xs mt-0.5">Email: {settings.email}</p>}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">{isPayroll ? 'Billed to (you)' : 'To'}</p>
            {isPayroll ? (
              <>
                <p className="font-medium">{settings?.legalName ?? settings?.tradingName ?? 'You'}</p>
                {settings?.address && <p className="text-slate-500 text-xs mt-0.5 whitespace-pre-line">{settings.address}</p>}
                {settings?.phone   && <p className="text-slate-500 text-xs mt-0.5">Tel: {settings.phone}</p>}
                {settings?.email   && <p className="text-slate-500 text-xs mt-0.5">Email: {settings.email}</p>}
              </>
            ) : (
              <>
                <p className="font-medium">{invoice.client?.name ?? '—'}</p>
                {invoice.client?.address && <p className="text-slate-500 text-xs mt-0.5 whitespace-pre-line">{invoice.client.address}</p>}
                {invoice.client?.phone   && <p className="text-slate-500 text-xs mt-0.5">Tel: {invoice.client.phone}</p>}
                {invoice.client?.email   && <p className="text-slate-500 text-xs mt-0.5">Email: {invoice.client.email}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entries ({invoice.entries.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 pb-4">
          {(invoice.entries as WorkEntry[]).map(e => {
            const fee    = Number(e.flatFee ?? 0)
            const travel = Number(e.travelExpenses ?? 0)
            // Payroll invoices: show flat fee only — travel doesn't attract commission
            const displayAmount = isPayroll ? fee : fee + travel
            return (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-slate-700">
                  {formatDateRange(e.date, e.endDate)}
                  {' — '}<span className="font-medium">{e.locationName}</span>
                  {e.details ? ` — ${e.details}` : ''}
                </span>
                <span className="shrink-0 ml-3">{formatCurrency(displayAmount)}</span>
              </div>
            )
          })}

          {totals && (
            <>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Gross fees</span><span>{formatCurrency(totals.grossFees)}</span>
                </div>
                {/* Travel expenses only relevant for standard (client) invoices */}
                {!isPayroll && totals.travelExpenses > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Travel expenses</span><span>{formatCurrency(totals.travelExpenses)}</span>
                  </div>
                )}
                {isPayroll && totals.exemptAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Commission-exempt amount</span><span>−{formatCurrency(totals.exemptAmount)}</span>
                  </div>
                )}
                {isPayroll && totals.exemptAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Commissionable fees</span><span>{formatCurrency(totals.commissionable)}</span>
                  </div>
                )}
                {isPayroll && (
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Commission ({+(commissionRate * 100).toFixed(2)}% of {totals.exemptAmount > 0 ? 'commissionable ' : ''}fees)</span>
                    <span>{formatCurrency(totals.commission)}</span>
                  </div>
                )}
                {!isPayroll && (
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(totals.grossFees + totals.travelExpenses)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardContent className="p-4 text-sm text-slate-600">
            <p className="text-xs text-slate-400 mb-1">Notes</p>
            {invoice.notes}
          </CardContent>
        </Card>
      )}

      {settings?.invoiceFooter && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 mb-1">Footer</p>
            <p className="text-xs text-slate-500 whitespace-pre-line">{settings.invoiceFooter}</p>
          </CardContent>
        </Card>
      )}

      <Button asChild variant="outline" size="sm">
        <Link href="/invoices">← Back to invoices</Link>
      </Button>
    </div>
  )
}
