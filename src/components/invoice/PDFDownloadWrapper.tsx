'use client'
import { useState } from 'react'
import { pdf, PDFDownloadLink } from '@react-pdf/renderer'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { ClientInvoicePDF } from './ClientInvoicePDF'
import { AgentInvoicePDF } from './AgentInvoicePDF'
import { appendReceiptsToPdf } from '@/lib/pdf-merge'
import type { Invoice, Client, Agent, WorkEntry, UserSettings } from '@/lib/db/schema'
import type { EntryReimbursement } from '@/lib/reimbursement'
import type { ReceiptView } from '@/lib/db/queries/receipts'

interface Props {
  invoice: Invoice & { client: Client | null; agent: Agent | null }
  settings: UserSettings
  entries: WorkEntry[]
  reimbursement?: Record<string, EntryReimbursement>
  // Receipts for this invoice's reimbursed travel items — when present, "Download PDF"
  // appends them as extra pages instead of downloading the invoice alone.
  receiptsToMerge?: ReceiptView[]
}

export function PDFDownloadWrapper({ invoice, settings, entries, reimbursement, receiptsToMerge = [] }: Props) {
  const isPayroll = invoice.type === 'agent_commission'
  const filename  = `${invoice.invoiceNumber}.pdf`
  const [working, setWorking] = useState(false)

  const pdfDocument = isPayroll && invoice.agent ? (
    <AgentInvoicePDF
      invoice={invoice}
      agent={invoice.agent}
      client={invoice.client}
      entries={entries}
      settings={settings}
    />
  ) : !isPayroll && invoice.client ? (
    <ClientInvoicePDF
      invoice={invoice}
      client={invoice.client}
      entries={entries}
      settings={settings}
      reimbursement={reimbursement}
    />
  ) : null

  if (!pdfDocument) return null

  // The common case — nothing to merge in — is untouched: same PDFDownloadLink flow as before.
  if (receiptsToMerge.length === 0) {
    return (
      <PDFDownloadLink document={pdfDocument} fileName={filename}>
        {({ loading }) => (
          <Button variant="outline" size="sm" disabled={loading}>
            <Download className="h-4 w-4 mr-1" />
            {loading ? 'Preparing…' : 'Download PDF'}
          </Button>
        )}
      </PDFDownloadLink>
    )
  }

  // Reimbursed travel with receipts attached: append them to the invoice PDF as extra pages,
  // so sending this one file to the client also sends the evidence for what they're
  // reimbursing — no separate scan-and-attach step by hand.
  async function handleDownload() {
    setWorking(true)
    try {
      const baseBlob = await pdf(pdfDocument!).toBlob()
      const baseBytes = await baseBlob.arrayBuffer()

      const items = await Promise.all(receiptsToMerge.map(async r => {
        try {
          const res = await fetch(`/api/receipts/${r.id}`)
          if (!res.ok) throw new Error(String(res.status))
          return { filename: r.originalFilename, mimeType: r.mimeType, bytes: await res.arrayBuffer() }
        } catch {
          return {
            filename: r.originalFilename,
            mimeType: r.mimeType,
            bytes: null,
            error: "Couldn't be downloaded just now — try again, or open it from the Receipts page.",
          }
        }
      }))

      const merged = await appendReceiptsToPdf(baseBytes, items)
      // pdf-lib's Uint8Array is typed over ArrayBufferLike (could be a SharedArrayBuffer),
      // which Blob's type doesn't accept — copy into a definite ArrayBuffer.
      const mergedBuffer = new ArrayBuffer(merged.byteLength)
      new Uint8Array(mergedBuffer).set(merged)
      const url = URL.createObjectURL(new Blob([mergedBuffer], { type: 'application/pdf' }))
      const a = window.document.createElement('a')
      a.href = url
      a.download = filename
      window.document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const failed = items.filter(i => !i.bytes).length
      if (failed > 0) {
        toast.warning(`Downloaded, but ${failed} receipt${failed === 1 ? '' : 's'} couldn't be fetched — a note page was added in ${failed === 1 ? 'its' : 'their'} place.`)
      } else {
        toast.success(`Downloaded with ${items.length} receipt${items.length === 1 ? '' : 's'} attached`)
      }
    } catch (error) {
      console.error('Failed to generate invoice PDF with receipts:', error)
      toast.error('Failed to generate the PDF. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={working}>
      {working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
      {working
        ? 'Preparing…'
        : `Download PDF (${receiptsToMerge.length} receipt${receiptsToMerge.length === 1 ? '' : 's'})`}
    </Button>
  )
}
