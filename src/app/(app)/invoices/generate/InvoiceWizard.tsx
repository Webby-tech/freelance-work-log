'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Client, Agent, UserSettings, WorkEntry } from '@/lib/db/schema'
import { createInvoiceAction } from '@/actions/invoice.actions'
import { calculateInvoiceTotals } from '@/lib/invoicing'
import { formatCurrency, formatDate, formatDateRange } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type ClientWithAgent = Client & { agent: Agent | null }

interface Props {
  clients: ClientWithAgent[]
  settings: UserSettings | null
}

export function InvoiceWizard({ clients, settings }: Props) {
  const router = useRouter()
  const [step,          setStep]          = useState(1)
  const [clientId,      setClientId]      = useState('')
  const [startDate,     setStartDate]     = useState('')
  const [endDate,       setEndDate]       = useState('')
  const [entries,       setEntries]       = useState<WorkEntry[]>([])
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [dueDate,       setDueDate]       = useState('')
  const [notes,         setNotes]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)
  const selectedEntries = entries.filter(e => selectedIds.has(e.id))

  const commissionRate = selectedClient?.agent
    ? Number(selectedClient.agent.commissionRate ?? 0.125)
    : 0.125

  const totals = selectedEntries.length > 0
    ? calculateInvoiceTotals(selectedEntries as WorkEntry[], commissionRate)
    : null

  // Step 1 → fetch entries
  async function fetchEntries() {
    if (!clientId || !startDate || !endDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ clientId, startDate, endDate })
      const res = await fetch(`/api/entries?${params}`)
      const data = await res.json()
      setEntries(data)
      setSelectedIds(new Set(data.map((e: WorkEntry) => e.id)))
      setStep(2)
    } catch {
      toast.error('Failed to load entries')
    } finally {
      setLoading(false)
    }
  }

  function toggleEntry(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleConfirm() {
    if (!selectedClient || selectedEntries.length === 0) return
    setSubmitting(true)
    try {
      const isPayroll = selectedClient.type === 'payroll'
      const type      = isPayroll ? 'agent_commission' : 'client'
      // Client invoices show fees only (mileage tracked internally for HMRC)
      const invoiceTotal = isPayroll ? totals!.commission : totals!.grossFees

      const entryDates    = selectedEntries.map(e => e.date).sort()
      const entryEndDates = selectedEntries.map(e => e.endDate ?? e.date).sort()
      const periodStart   = entryDates[0]
      const periodEnd     = entryEndDates[entryEndDates.length - 1]

      await createInvoiceAction({
        clientId:      clientId,   // always store — needed for PDF on payroll invoices
        agentId:       isPayroll ? selectedClient.agentId : null,
        type,
        periodStart,
        periodEnd,
        issuedDate:    new Date().toISOString().split('T')[0],
        dueDate:       dueDate || null,
        status:        'draft',
        subtotal:      String(totals!.grossFees),
        commissionAmt: isPayroll ? String(totals!.commission) : null,
        vatAmount:     '0',
        total:         String(invoiceTotal),
        notes:         notes || null,
      }, selectedEntries.map(e => e.id))

      toast.success('Invoice created')
      router.push('/invoices')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
              ${step === n ? 'bg-slate-900 text-white' : step > n ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {n}
            </div>
            {n < 4 && <div className="w-8 h-px bg-slate-200" />}
          </div>
        ))}
        <span className="ml-2 text-slate-500">
          {['Select client', 'Review entries', 'Preview', 'Confirm'][step - 1]}
        </span>
      </div>

      {/* ── Step 1: Select client + date range ── */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-xs">Client *</Label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                required
                className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.type === 'payroll' ? ' (Payroll)' : ''}
                  </option>
                ))}
              </select>
              {selectedClient?.type === 'payroll' && !selectedClient.agentId && (
                <p className="text-xs text-amber-600 mt-1">This payroll client has no agent linked. Edit the client to add one.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Period start *</Label>
                <Input className="mt-1" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Period end *</Label>
                <Input className="mt-1" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
              </div>
            </div>
            <Button
              onClick={fetchEntries}
              disabled={!clientId || !startDate || !endDate || loading}
              className="w-full"
            >
              {loading ? 'Loading entries…' : 'Next: Review entries →'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Review entries ── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-2">
              <p className="text-sm font-medium mb-3">
                {entries.length} uninvoiced {entries.length === 1 ? 'entry' : 'entries'} for {selectedClient?.name}
              </p>
              {entries.length === 0 ? (
                <p className="text-sm text-slate-500 py-3">No uninvoiced entries found for this period.</p>
              ) : (
                <div className="space-y-2">
                  {entries.map(e => (
                    <div key={e.id} className="flex items-start gap-3">
                      <Checkbox
                        id={e.id}
                        checked={selectedIds.has(e.id)}
                        onCheckedChange={() => toggleEntry(e.id)}
                        className="mt-0.5"
                      />
                      <label htmlFor={e.id} className="flex-1 cursor-pointer text-sm">
                        <span className="font-medium">{e.locationName}</span>
                        <span className="text-slate-500 ml-2 text-xs">{formatDateRange(e.date, e.endDate)}</span>
                        <span className="text-slate-600 ml-2 text-xs">
                          {formatCurrency(Number(e.flatFee))}
                          {e.returnMiles ? ` + ${e.returnMiles} mi` : ''}
                          {Number(e.travelExpenses) > 0 ? ` + travel ${formatCurrency(Number(e.travelExpenses))}` : ''}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button
              onClick={() => setStep(3)}
              disabled={selectedIds.size === 0}
              className="flex-1"
            >
              Next: Preview →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && totals && selectedClient && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {selectedClient.type === 'payroll'
                    ? `Commission deduction — ${selectedClient.agent?.name ?? 'Agent'} → You`
                    : `Client invoice — You → ${selectedClient.name}`}
                </span>
                <Badge>{selectedClient.type === 'payroll' ? 'Payroll' : 'Standard'}</Badge>
              </div>
              {selectedClient.type === 'payroll' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                  This records commission <strong>owed by you</strong> to {selectedClient.agent?.name ?? 'your agent'} — money going <strong>out</strong>.
                </p>
              )}
              <Separator />
              <div className="text-sm space-y-1">
                <Row label="Payroll client" value={selectedClient.name} />
                {selectedClient.type === 'payroll' && selectedClient.agent && (
                  <Row label="Agent (billed from)" value={selectedClient.agent.name} />
                )}
                <Row label="Period" value={`${formatDate(startDate)} – ${formatDate(endDate)}`} />
                <Row label="Entries" value={String(selectedEntries.length)} />
              </div>
              <Separator />
              <div className="text-sm space-y-1">
                <Row label="Gross fees" value={formatCurrency(totals.grossFees)} />
                {selectedClient.type === 'payroll' && (
                  <>
                    {totals.exemptAmount > 0 && (
                      <Row label="Commission-exempt amount" value={`−${formatCurrency(totals.exemptAmount)}`} />
                    )}
                    {totals.exemptAmount > 0 && (
                      <Row label="Commissionable fees" value={formatCurrency(totals.commissionable)} />
                    )}
                    <Row
                      label={`Commission (${+(commissionRate * 100).toFixed(2)}% of ${totals.exemptAmount > 0 ? 'commissionable ' : ''}fees)`}
                      value={formatCurrency(totals.commission)}
                      bold
                    />
                    {totals.travelExpenses > 0 && (
                      <p className="text-xs text-slate-400 pt-1">
                        Note: £{totals.travelExpenses.toFixed(2)} travel expenses excluded — not subject to commission.
                      </p>
                    )}
                  </>
                )}
                {selectedClient.type === 'standard' && (
                  <>
                    {totals.travelExpenses > 0 && (
                      <Row label="Travel expenses" value={formatCurrency(totals.travelExpenses)} />
                    )}
                    <Row label="Total" value={formatCurrency(totals.grossFees + totals.travelExpenses)} bold />
                  </>
                )}
              </div>

              <Separator />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Due date (optional)</Label>
                  <Input className="mt-1" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes on invoice" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={() => setStep(4)} className="flex-1">Next: Confirm →</Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === 4 && totals && selectedClient && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-2 text-sm">
              <p className="font-medium">Ready to record this invoice?</p>
              {selectedClient.type === 'payroll' ? (
                <p className="text-slate-500">
                  This will lock the {selectedEntries.length} selected {selectedEntries.length === 1 ? 'entry' : 'entries'} and record a commission deduction invoice
                  from <strong>{selectedClient.agent?.name ?? 'your agent'}</strong> — this is money <strong>you owe</strong> your agent, not money coming in.
                </p>
              ) : (
                <p className="text-slate-500">
                  This will lock the {selectedEntries.length} selected {selectedEntries.length === 1 ? 'entry' : 'entries'} and create a client invoice
                  to <strong>{selectedClient.name}</strong>.
                </p>
              )}
              <p className="font-semibold text-base mt-2">
                {selectedClient.type === 'payroll' ? 'Commission due: ' : 'Invoice total: '}
                {formatCurrency(selectedClient.type === 'payroll' ? totals.commission : totals.grossFees)}
              </p>
              <p className="text-xs text-slate-400">You can mark it as sent / paid / void it from the Invoices list.</p>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
            <Button onClick={handleConfirm} disabled={submitting} className="flex-1">
              {submitting ? 'Creating…' : 'Create invoice'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  )
}
