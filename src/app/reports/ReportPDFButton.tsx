'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { ReportEntry, ReportInvoice } from '@/lib/db/queries/reports'
import type { Expense, UserSettings } from '@/lib/db/schema'
import type { TaxYear } from '@/lib/tax-year'
import type { ReportSummary, MonthRow, ClientRow } from '@/components/reports/AnnualReportPDF'

const ReportPDFWrapper = dynamic(
  () => import('@/components/reports/ReportPDFWrapper').then(m => m.ReportPDFWrapper),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-1" />Preparing…
      </Button>
    ),
  }
)

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

export function ReportPDFButton(props: Props) {
  const [ready, setReady] = useState(false)

  if (!ready) {
    return (
      <Button variant="outline" size="sm" onClick={() => setReady(true)}>
        <Download className="h-4 w-4 mr-1" />Download PDF
      </Button>
    )
  }

  return <ReportPDFWrapper {...props} />
}
