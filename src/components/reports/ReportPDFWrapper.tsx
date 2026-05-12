'use client'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { AnnualReportPDF } from './AnnualReportPDF'
import type { ReportEntry, ReportInvoice } from '@/lib/db/queries/reports'
import type { Expense, UserSettings } from '@/lib/db/schema'
import type { TaxYear } from '@/lib/tax-year'
import type { ReportSummary, MonthRow, ClientRow } from './AnnualReportPDF'

interface Props {
  taxYear:   TaxYear
  isPartial: boolean
  entries:   ReportEntry[]
  invoices:  ReportInvoice[]
  expenses:  Expense[]
  settings:  UserSettings
  summary:   ReportSummary
  byMonth:   MonthRow[]
  byClient:  ClientRow[]
}

export function ReportPDFWrapper(props: Props) {
  const yearLabel = props.taxYear.label.replace('/', '-')
  const filename  = `tax-summary-${yearLabel}.pdf`

  return (
    <PDFDownloadLink
      document={<AnnualReportPDF {...props} />}
      fileName={filename}
    >
      {({ loading }) => (
        <Button variant="outline" size="sm" disabled={loading}>
          <Download className="h-4 w-4 mr-1" />
          {loading ? 'Preparing…' : 'Download PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  )
}
