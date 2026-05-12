'use client'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import type { Invoice, Client, Agent, WorkEntry, UserSettings } from '@/lib/db/schema'
import { calculateInvoiceTotals } from '@/lib/invoicing'
import { formatDate, formatDateRange } from '@/lib/utils'

const styles = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#1e293b' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  title:     { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  meta:      { fontSize: 8, color: '#64748b', marginTop: 2 },
  label:     { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  rowBold:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4 },
  colLeft:   { flex: 1 },
  colRight:  { width: 80, textAlign: 'right' },
  parties:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  party:     { width: '45%' },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  section:   { marginBottom: 16 },
  note:      { fontSize: 7, color: '#94a3b8', marginTop: 12 },
  rightAlign:{ alignItems: 'flex-end' },
})

interface Props {
  invoice: Invoice
  agent: Agent
  client: Client | null
  entries: WorkEntry[]
  settings: UserSettings
}

export function AgentInvoicePDF({ invoice, agent, client, entries, settings }: Props) {
  const commissionRate = Number(agent.commissionRate ?? 0.125)
  const totals = calculateInvoiceTotals(entries, commissionRate)
  const commissionPct = `${+(commissionRate * 100).toFixed(2)}%`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>COMMISSION INVOICE</Text>
            <Text style={styles.meta}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.rightAlign}>
            <Text style={styles.meta}>Issued: {invoice.issuedDate ? formatDate(invoice.issuedDate) : ''}</Text>
            {invoice.dueDate ? <Text style={styles.meta}>Due: {formatDate(invoice.dueDate)}</Text> : null}
          </View>
        </View>

        {/* Agent is the sender; actor is the recipient */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>From (Agent)</Text>
            <Text style={styles.partyName}>{agent.name}</Text>
            {agent.address ? <Text style={styles.meta}>{agent.address}</Text> : null}
            {agent.email   ? <Text style={styles.meta}>{agent.email}</Text>   : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>To (Artiste)</Text>
            <Text style={styles.partyName}>{settings.legalName ?? settings.tradingName ?? 'Artist'}</Text>
            {settings.address   ? <Text style={styles.meta}>{settings.address}</Text>        : null}
            {settings.phone     ? <Text style={styles.meta}>Tel: {settings.phone}</Text>     : null}
            {settings.utrNumber ? <Text style={styles.meta}>UTR: {settings.utrNumber}</Text> : null}
          </View>
        </View>

        {/* Earnings summary */}
        <View style={styles.section}>
          <Text style={styles.label}>Engagement summary{client ? ` — ${client.name}` : ''}</Text>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }]}>
            <Text style={[styles.colLeft, { fontFamily: 'Helvetica-Bold' }]}>Engagement</Text>
            <Text style={[styles.colRight, { fontFamily: 'Helvetica-Bold' }]}>Fee</Text>
          </View>
          {entries.map(e => {
            const dateStr = formatDateRange(e.date, e.endDate)
            const desc = [dateStr, e.locationName ?? '', e.details ?? ''].filter(Boolean).join(' — ')
            return (
              <View key={e.id} style={styles.row}>
                <Text style={styles.colLeft}>{desc}</Text>
                <Text style={styles.colRight}>{`£${Number(e.flatFee ?? 0).toFixed(2)}`}</Text>
              </View>
            )
          })}
          <View style={styles.row}>
            <Text style={styles.colLeft}>Gross fees total</Text>
            <Text style={styles.colRight}>{`£${totals.grossFees.toFixed(2)}`}</Text>
          </View>
        </View>

        {/* Commission calculation */}
        <View style={styles.section}>
          <Text style={styles.label}>Commission</Text>
          <View style={styles.row}>
            <Text style={styles.colLeft}>Gross fees</Text>
            <Text style={styles.colRight}>{`£${totals.grossFees.toFixed(2)}`}</Text>
          </View>
          {totals.exemptAmount > 0 && (
            <View style={styles.row}>
              <Text style={[styles.colLeft, { color: '#64748b' }]}>
                Commission-exempt (allowance / costume fitting / holiday scheme)
              </Text>
              <Text style={[styles.colRight, { color: '#64748b' }]}>{`−£${totals.exemptAmount.toFixed(2)}`}</Text>
            </View>
          )}
          {totals.exemptAmount > 0 && (
            <View style={styles.row}>
              <Text style={styles.colLeft}>Commissionable fees</Text>
              <Text style={styles.colRight}>{`£${totals.commissionable.toFixed(2)}`}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.colLeft}>
              {totals.exemptAmount > 0
                ? `Commission @ ${commissionPct} of commissionable fees`
                : `Commission @ ${commissionPct} of gross fees`}
            </Text>
            <Text style={styles.colRight}>{`£${totals.commission.toFixed(2)}`}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.colLeft, { color: '#64748b' }]}>
              Commission calculated on fees only — mileage and travel expenses excluded
            </Text>
          </View>
          <View style={styles.rowBold}>
            <Text style={[styles.colLeft, { fontFamily: 'Helvetica-Bold' }]}>Commission due</Text>
            <Text style={[styles.colRight, { fontFamily: 'Helvetica-Bold' }]}>{`£${totals.commission.toFixed(2)}`}</Text>
          </View>
        </View>

        {invoice.notes ? <Text style={styles.note}>{invoice.notes}</Text> : null}
        {settings.invoiceFooter
          ? <Text style={styles.note}>{settings.invoiceFooter}</Text>
          : <Text style={styles.note}>Thank you for your business.</Text>
        }
      </Page>
    </Document>
  )
}
