'use client'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { ClientInvoicePDF } from './ClientInvoicePDF'
import { AgentInvoicePDF } from './AgentInvoicePDF'
import type { Invoice, Client, Agent, WorkEntry, UserSettings } from '@/lib/db/schema'

interface Props {
  invoice: Invoice & { client: Client | null; agent: Agent | null }
  settings: UserSettings
  entries: WorkEntry[]
}

export function PDFDownloadWrapper({ invoice, settings, entries }: Props) {
  const isPayroll = invoice.type === 'agent_commission'
  const filename  = `${invoice.invoiceNumber}.pdf`

  const document = isPayroll && invoice.agent ? (
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
    />
  ) : null

  if (!document) return null

  return (
    <PDFDownloadLink document={document} fileName={filename}>
      {({ loading }) => (
        <Button variant="outline" size="sm" disabled={loading}>
          <Download className="h-4 w-4 mr-1" />
          {loading ? 'Preparing…' : 'Download PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  )
}
