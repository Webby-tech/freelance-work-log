'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  markInvoiceSentAction,
  markInvoicePaidAction,
  markInvoiceOverdueAction,
  voidInvoiceAction,
} from '@/actions/invoice.actions'
import type { InvoiceStatus } from '@/lib/db/schema'

interface Props {
  invoiceId: string
  currentStatus: string
}

export function InvoiceStatusActions({ invoiceId, currentStatus }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function act(action: () => Promise<void>, label: string) {
    setBusy(true)
    try {
      await action()
      toast.success(label)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-1 shrink-0 flex-wrap justify-end">
      {currentStatus === 'draft' && (
        <Button variant="outline" size="sm" disabled={busy}
          onClick={() => act(() => markInvoiceSentAction(invoiceId), 'Marked as sent')}>
          Mark sent
        </Button>
      )}
      {(currentStatus === 'sent' || currentStatus === 'overdue') && (
        <Button variant="outline" size="sm" disabled={busy}
          onClick={() => act(() => markInvoicePaidAction(invoiceId), 'Marked as paid')}>
          Mark paid
        </Button>
      )}
      {currentStatus === 'sent' && (
        <Button variant="outline" size="sm" disabled={busy}
          onClick={() => act(() => markInvoiceOverdueAction(invoiceId), 'Marked as overdue')}>
          Overdue
        </Button>
      )}
      {currentStatus !== 'paid' && (
        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" disabled={busy}
          onClick={() => {
            if (confirm('Void this invoice? The entries will be unlocked for re-invoicing.'))
              act(() => voidInvoiceAction(invoiceId), 'Invoice voided')
          }}>
          Void
        </Button>
      )}
    </div>
  )
}
