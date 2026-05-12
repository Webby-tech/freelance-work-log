'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { Invoice, Client, Agent, WorkEntry, UserSettings } from '@/lib/db/schema'

// Single dynamic import — all react-pdf code loads together, eliminating the
// race condition where PDFDownloadLink resolves before the document component.
const PDFDownloadWrapper = dynamic(
  () => import('@/components/invoice/PDFDownloadWrapper').then(m => m.PDFDownloadWrapper),
  { ssr: false, loading: () => <Button variant="outline" size="sm" disabled><Download className="h-4 w-4 mr-1" />Preparing…</Button> }
)

interface Props {
  invoice: Invoice & { client: Client | null; agent: Agent | null }
  settings: UserSettings
  entries: WorkEntry[]
}

export function InvoicePDFButton({ invoice, settings, entries }: Props) {
  const [ready, setReady] = useState(false)

  if (!ready) {
    return (
      <Button variant="outline" size="sm" onClick={() => setReady(true)}>
        <Download className="h-4 w-4 mr-1" /> Download PDF
      </Button>
    )
  }

  return <PDFDownloadWrapper invoice={invoice} settings={settings} entries={entries} />
}
