'use client'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import type { Invoice, Client, WorkEntry, UserSettings } from '@/lib/db/schema'
import { calculateInvoiceTotals } from '@/lib/invoicing'
import { formatDate, formatDateRange } from '@/lib/utils'

const styles = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#1e293b' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  title:      { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  meta:       { fontSize: 8, color: '#64748b', marginTop: 2 },
  section:    { marginBottom: 16 },
  label:      { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  rowBold:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4 },
  colLeft:    { flex: 1 },
  colRight:   { width: 80, textAlign: 'right' },
  parties:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  party:      { width: '45%' },
  partyName:  { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  note:       { fontSize: 7, color: '#94a3b8', marginTop: 12 },
  bankBox:    { backgroundColor: '#f8fafc', padding: 8, borderRadius: 3, marginTop: 12 },
  // alignItems: flex-end replaces textAlign: right on a View
  rightAlign: { alignItems: 'flex-end' },
})

interface Props {
  invoice: Invoice
  client: Client
  entries: WorkEntry[]
  settings: UserSettings
}

export function ClientInvoicePDF({ invoice, client, entries, settings }: Props) {
  const totals = calculateInvoiceTotals(entries)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.meta}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.rightAlign}>
            <Text style={styles.meta}>Issued: {invoice.issuedDate ? formatDate(invoice.issuedDate) : ''}</Text>
            {invoice.dueDate ? <Text style={styles.meta}>Due: {formatDate(invoice.dueDate)}</Text> : null}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>From</Text>
            <Text style={styles.partyName}>{settings.tradingName ?? settings.legalName ?? 'Actor'}</Text>
            {settings.address   ? <Text style={styles.meta}>{settings.address}</Text>          : null}
            {settings.phone     ? <Text style={styles.meta}>Tel: {settings.phone}</Text>       : null}
            {settings.email     ? <Text style={styles.meta}>{settings.email}</Text>            : null}
            {settings.utrNumber ? <Text style={styles.meta}>UTR: {settings.utrNumber}</Text>   : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>To</Text>
            <Text style={styles.partyName}>{client.name}</Text>
            {client.address ? <Text style={styles.meta}>{client.address}</Text>          : null}
            {client.phone   ? <Text style={styles.meta}>Tel: {client.phone}</Text>      : null}
            {client.email   ? <Text style={styles.meta}>{client.email}</Text>           : null}
          </View>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <Text style={styles.label}>Services</Text>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }]}>
            <Text style={[styles.colLeft, { fontFamily: 'Helvetica-Bold' }]}>Description</Text>
            <Text style={[styles.colRight, { fontFamily: 'Helvetica-Bold' }]}>Amount</Text>
          </View>

          {entries.map(e => {
            const fee    = Number(e.flatFee ?? 0)
            const travel = Number(e.travelExpenses ?? 0)
            const lineTotal = fee + travel

            const dateStr = formatDateRange(e.date, e.endDate)
            const desc = [dateStr, e.locationName ?? '', e.details ?? ''].filter(Boolean).join(' — ')

            return (
              <View key={e.id} style={styles.row}>
                <Text style={styles.colLeft}>{desc}</Text>
                <Text style={styles.colRight}>{`£${lineTotal.toFixed(2)}`}</Text>
              </View>
            )
          })}

          <View style={styles.rowBold}>
            <Text style={[styles.colLeft, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
            <Text style={[styles.colRight, { fontFamily: 'Helvetica-Bold' }]}>{`£${totals.grossFees.toFixed(2)}`}</Text>
          </View>
        </View>

        {/* Bank details */}
        {settings.bankAccount ? (
          <View style={styles.bankBox}>
            <Text style={styles.label}>Payment details</Text>
            {settings.bankName     ? <Text style={styles.meta}>Bank: {settings.bankName}</Text>           : null}
            {settings.bankSortCode ? <Text style={styles.meta}>Sort code: {settings.bankSortCode}</Text>  : null}
            {settings.bankAccount  ? <Text style={styles.meta}>Account: {settings.bankAccount}</Text>     : null}
          </View>
        ) : null}

        {/* Notes + footer */}
        {invoice.notes ? <Text style={styles.note}>{invoice.notes}</Text> : null}
        {settings.invoiceFooter
          ? <Text style={styles.note}>{settings.invoiceFooter}</Text>
          : <Text style={styles.note}>Thank you for your business.</Text>
        }
      </Page>
    </Document>
  )
}
