'use client'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import type { ReportEntry, ReportInvoice } from '@/lib/db/queries/reports'
import type { Expense, UserSettings } from '@/lib/db/schema'
import type { TaxYear } from '@/lib/tax-year'
import { MILEAGE_RATE_STANDARD, MILEAGE_RATE_REDUCED, MILEAGE_THRESHOLD } from '@/lib/tax-year'

const c = {
  black:   '#111827',
  grey:    '#6b7280',
  light:   '#f3f4f6',
  border:  '#e5e7eb',
  accent:  '#1e3a5f',
  green:   '#15803d',
  amber:   '#b45309',
}

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: c.black, padding: 40 },
  header:     { marginBottom: 20, borderBottom: `1 solid ${c.border}`, paddingBottom: 12 },
  title:      { fontSize: 18, fontFamily: 'Helvetica-Bold', color: c.accent },
  subtitle:   { fontSize: 10, color: c.grey, marginTop: 3 },
  badge:      { fontSize: 7, color: '#92400e', backgroundColor: '#fef3c7', padding: '2 6', borderRadius: 3, marginTop: 4, alignSelf: 'flex-start' },
  section:    { marginTop: 16 },
  sectionHd:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.grey, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottom: `1 solid ${c.border}` },
  summaryLbl: { color: c.grey },
  summaryVal: { fontFamily: 'Helvetica-Bold' },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, marginTop: 2, backgroundColor: c.accent },
  totalLbl:   { color: '#ffffff', fontFamily: 'Helvetica-Bold', paddingHorizontal: 8 },
  totalVal:   { color: '#ffffff', fontFamily: 'Helvetica-Bold', paddingHorizontal: 8 },
  table:      { marginTop: 4 },
  tHead:      { flexDirection: 'row', backgroundColor: c.light, paddingVertical: 4, paddingHorizontal: 4 },
  tHd:        { fontFamily: 'Helvetica-Bold', fontSize: 8, color: c.grey },
  tRow:       { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottom: `1 solid ${c.border}` },
  tCell:      { fontSize: 8 },
  taxNote:    { marginTop: 10, fontSize: 7.5, color: c.grey, fontStyle: 'italic' },
  footer:     { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: c.grey, borderTop: `1 solid ${c.border}`, paddingTop: 6 },
  warningBox: { backgroundColor: '#fef3c7', padding: 8, borderRadius: 3, marginTop: 10 },
  warningTxt: { fontSize: 8, color: '#92400e' },
})

function gbp(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d: string) {
  return format(parseISO(d), 'd MMM yyyy')
}

interface Props {
  taxYear:     TaxYear
  isPartial:   boolean
  entries:     ReportEntry[]
  invoices:    ReportInvoice[]
  expenses:    Expense[]
  settings:    UserSettings
  summary:     ReportSummary
  byMonth:     MonthRow[]
  byClient:    ClientRow[]
}

export interface ReportSummary {
  grossFees:             number
  mileageClaim:          number
  totalReturnMiles:      number
  travelExpenses:        number
  agentCommission:       number
  generalExpenses:       number
  totalAllowableExpenses: number
  taxableProfit:         number
  estimatedTax:          number
  taxRate:               number
  higherRateBand:        boolean
}

export interface MonthRow {
  key:            string
  label:          string
  grossFees:      number
  mileageClaim:   number
  travelExpenses: number
  count:          number
}

export interface ClientRow {
  name:           string
  type:           string
  grossFees:      number
  mileageClaim:   number
  travelExpenses: number
  count:          number
}

export function AnnualReportPDF({ taxYear, isPartial, entries, invoices, expenses, settings, summary, byMonth, byClient }: Props) {
  const name = settings.tradingName || settings.legalName || 'Actor'
  const yearLabel = taxYear.label.replace('/', '/20')
  const generatedOn = format(new Date(), 'd MMM yyyy')

  return (
    <Document title={`Annual Report ${yearLabel}`} author={name}>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Annual Tax Summary {yearLabel}</Text>
          <Text style={s.subtitle}>{name}{settings.utrNumber ? `  ·  UTR ${settings.utrNumber}` : ''}</Text>
          {isPartial && <Text style={s.badge}>Year in progress — figures are YTD</Text>}
        </View>

        {/* Income & expenses summary */}
        <View style={s.section}>
          <Text style={s.sectionHd}>Income &amp; Allowable Expenses</Text>
          <View style={s.summaryRow}>
            <Text style={s.summaryLbl}>Gross fees</Text>
            <Text style={s.summaryVal}>{gbp(summary.grossFees)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLbl}>Mileage claim ({summary.totalReturnMiles} mi at HMRC rate)</Text>
            <Text style={s.summaryVal}>{gbp(summary.mileageClaim)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLbl}>Travel expenses</Text>
            <Text style={s.summaryVal}>{gbp(summary.travelExpenses)}</Text>
          </View>
          {summary.agentCommission > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLbl}>Agent commission paid</Text>
              <Text style={s.summaryVal}>{gbp(summary.agentCommission)}</Text>
            </View>
          )}
          {summary.generalExpenses > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLbl}>General business expenses</Text>
              <Text style={s.summaryVal}>{gbp(summary.generalExpenses)}</Text>
            </View>
          )}
          <View style={s.summaryRow}>
            <Text style={s.summaryLbl}>Total allowable expenses</Text>
            <Text style={s.summaryVal}>{gbp(summary.totalAllowableExpenses)}</Text>
          </View>
          <View style={[s.totalRow, { marginTop: 6 }]}>
            <Text style={s.totalLbl}>Taxable profit</Text>
            <Text style={s.totalVal}>{gbp(summary.taxableProfit)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLbl}>Estimated income tax @ {Math.round(summary.taxRate * 100)}%</Text>
            <Text style={[s.summaryVal, { color: c.amber }]}>{gbp(summary.estimatedTax)}</Text>
          </View>
        </View>

        {summary.higherRateBand && (
          <View style={s.warningBox}>
            <Text style={s.warningTxt}>⚠  Taxable profit exceeds the £37,700 basic rate band — some income may be taxed at 40%.</Text>
          </View>
        )}

        <Text style={s.taxNote}>
          Personal allowance is fully used by pension income — acting income taxable from £1. No NI (age 67).
          {settings.utrNumber ? '' : '  UTR not set — add in Settings.'}
        </Text>

        {/* Monthly breakdown */}
        <View style={s.section}>
          <Text style={s.sectionHd}>Monthly Breakdown</Text>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.tHd, { width: '22%' }]}>Month</Text>
              <Text style={[s.tHd, { width: '10%', textAlign: 'right' }]}>Jobs</Text>
              <Text style={[s.tHd, { width: '23%', textAlign: 'right' }]}>Gross fees</Text>
              <Text style={[s.tHd, { width: '23%', textAlign: 'right' }]}>Mileage</Text>
              <Text style={[s.tHd, { width: '22%', textAlign: 'right' }]}>Travel</Text>
            </View>
            {byMonth.map(m => (
              <View key={m.key} style={s.tRow}>
                <Text style={[s.tCell, { width: '22%' }]}>{m.label}</Text>
                <Text style={[s.tCell, { width: '10%', textAlign: 'right' }]}>{m.count}</Text>
                <Text style={[s.tCell, { width: '23%', textAlign: 'right' }]}>{gbp(m.grossFees)}</Text>
                <Text style={[s.tCell, { width: '23%', textAlign: 'right' }]}>{gbp(m.mileageClaim)}</Text>
                <Text style={[s.tCell, { width: '22%', textAlign: 'right' }]}>{gbp(m.travelExpenses)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Client breakdown */}
        <View style={s.section}>
          <Text style={s.sectionHd}>By Client</Text>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.tHd, { width: '38%' }]}>Client</Text>
              <Text style={[s.tHd, { width: '16%' }]}>Type</Text>
              <Text style={[s.tHd, { width: '14%', textAlign: 'right' }]}>Jobs</Text>
              <Text style={[s.tHd, { width: '32%', textAlign: 'right' }]}>Gross fees</Text>
            </View>
            {byClient.map(cl => (
              <View key={cl.name} style={s.tRow}>
                <Text style={[s.tCell, { width: '38%' }]}>{cl.name}</Text>
                <Text style={[s.tCell, { width: '16%', color: c.grey }]}>{cl.type}</Text>
                <Text style={[s.tCell, { width: '14%', textAlign: 'right' }]}>{cl.count}</Text>
                <Text style={[s.tCell, { width: '32%', textAlign: 'right' }]}>{gbp(cl.grossFees)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Invoice register */}
        {invoices.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHd}>Invoice Register</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.tHd, { width: '24%' }]}>Invoice no.</Text>
                <Text style={[s.tHd, { width: '14%' }]}>Issued</Text>
                <Text style={[s.tHd, { width: '26%' }]}>Client / Agent</Text>
                <Text style={[s.tHd, { width: '18%' }]}>Type</Text>
                <Text style={[s.tHd, { width: '18%', textAlign: 'right' }]}>Amount</Text>
              </View>
              {invoices.map(inv => {
                const isCommission = inv.type === 'agent_commission'
                return (
                  <View key={inv.id} style={s.tRow}>
                    <Text style={[s.tCell, { width: '24%' }]}>{inv.invoiceNumber}</Text>
                    <Text style={[s.tCell, { width: '14%', color: c.grey }]}>{fmtDate(inv.issuedDate)}</Text>
                    <Text style={[s.tCell, { width: '26%' }]}>{inv.client?.name ?? inv.agent?.name ?? '—'}</Text>
                    <Text style={[s.tCell, { width: '18%', color: isCommission ? '#b91c1c' : c.green }]}>
                      {isCommission ? 'Commission out' : 'Income'}
                    </Text>
                    <Text style={[s.tCell, { width: '18%', textAlign: 'right', color: isCommission ? '#b91c1c' : c.black }]}>
                      {isCommission ? `(${gbp(Number(inv.total))})` : gbp(Number(inv.total))}
                    </Text>
                  </View>
                )
              })}
            </View>
            <Text style={[s.taxNote, { marginTop: 4 }]}>
              Amounts in (brackets) in red are outgoing commission payments, not income.
              Payroll client income (e.g. PNP Events) is paid gross by the payroll company with no tax deducted at source — no invoice is raised by me, hence it does not appear here.
            </Text>
          </View>
        )}

        {/* Travel & Mileage breakdown */}
        {(() => {
          type TRow = { key: string; date: string; job: string; description: string; amount: number; isMileage?: boolean }
          const travelRows: TRow[] = []
          let runningMiles = 0
          for (const e of entries) {
            const miles = e.returnMiles ?? 0
            const hasTravelExpenses = Number(e.travelExpenses ?? 0) > 0
            if (miles === 0 && !hasTravelExpenses) continue

            const job     = `${e.locationName}${e.details ? ` — ${e.details}` : ''}`
            const dateStr = fmtDate(e.date)
            let firstRow  = true

            if (miles > 0) {
              const standardMiles = Math.min(miles, Math.max(0, MILEAGE_THRESHOLD - runningMiles))
              const reducedMiles  = miles - standardMiles
              const mileValue     = standardMiles * MILEAGE_RATE_STANDARD + reducedMiles * MILEAGE_RATE_REDUCED
              const ratePence     = Math.round((reducedMiles > 0 ? MILEAGE_RATE_REDUCED : MILEAGE_RATE_STANDARD) * 100)
              runningMiles += miles
              travelRows.push({ key: `${e.id}-mileage`, date: dateStr, job, description: `Mileage — ${miles} mi @ ${ratePence}p/mi`, amount: mileValue, isMileage: true })
              firstRow = false
            }

            if (hasTravelExpenses) {
              if (e.travelItems && e.travelItems.length > 0) {
                e.travelItems.forEach((item, idx) => {
                  travelRows.push({ key: `${e.id}-t${idx}`, date: firstRow && idx === 0 ? dateStr : '', job: firstRow && idx === 0 ? job : '', description: item.description, amount: Number(item.amount) })
                  firstRow = false
                })
              } else {
                travelRows.push({ key: `${e.id}-travel`, date: firstRow ? dateStr : '', job: firstRow ? job : '', description: 'Travel expenses', amount: Number(e.travelExpenses) })
              }
            }
          }
          if (travelRows.length === 0) return null
          return (
            <View style={s.section}>
              <Text style={s.sectionHd}>Travel &amp; Mileage</Text>
              <View style={s.table}>
                <View style={s.tHead}>
                  <Text style={[s.tHd, { width: '18%' }]}>Date</Text>
                  <Text style={[s.tHd, { width: '32%' }]}>Job</Text>
                  <Text style={[s.tHd, { width: '32%' }]}>Description</Text>
                  <Text style={[s.tHd, { width: '18%', textAlign: 'right' }]}>Amount</Text>
                </View>
                {travelRows.map(row => (
                  <View key={row.key} style={s.tRow}>
                    <Text style={[s.tCell, { width: '18%', color: c.grey }]}>{row.date}</Text>
                    <Text style={[s.tCell, { width: '32%' }]}>{row.job}</Text>
                    <Text style={[s.tCell, { width: '32%', color: row.isMileage ? c.grey : c.black, fontStyle: row.isMileage ? 'italic' : 'normal' }]}>{row.description}</Text>
                    <Text style={[s.tCell, { width: '18%', textAlign: 'right' }]}>{gbp(row.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )
        })()}

        {/* General expenses */}
        {expenses.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHd}>General Business Expenses</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.tHd, { width: '18%' }]}>Date</Text>
                <Text style={[s.tHd, { width: '22%' }]}>Category</Text>
                <Text style={[s.tHd, { width: '42%' }]}>Description</Text>
                <Text style={[s.tHd, { width: '18%', textAlign: 'right' }]}>Amount</Text>
              </View>
              {expenses.map(exp => (
                <View key={exp.id} style={s.tRow}>
                  <Text style={[s.tCell, { width: '18%' }]}>{fmtDate(exp.date)}</Text>
                  <Text style={[s.tCell, { width: '22%' }]}>{exp.category}</Text>
                  <Text style={[s.tCell, { width: '42%' }]}>{exp.description}</Text>
                  <Text style={[s.tCell, { width: '18%', textAlign: 'right' }]}>{gbp(Number(exp.amount))}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>Annual Tax Summary {yearLabel} — {name}</Text>
          <Text>Generated {generatedOn}</Text>
        </View>
      </Page>
    </Document>
  )
}

export { MILEAGE_RATE_STANDARD, MILEAGE_RATE_REDUCED, MILEAGE_THRESHOLD }
