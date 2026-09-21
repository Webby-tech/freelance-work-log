import type { WorkEntry } from './db/schema'
import type { EntryReimbursement } from './reimbursement'
import { roundMoney } from './reimbursement'

export function calculateInvoiceTotals(
  entries: WorkEntry[],
  commissionRate = 0.125,
  // Per-entry reimbursed travel, keyed by entry id. Omit for entries that don't use it.
  reimbursement: Record<string, Pick<EntryReimbursement, 'flagged' | 'billable'>> = {}
) {
  const grossFees      = entries.reduce((sum, e) => sum + Number(e.flatFee), 0)
  const exemptAmount   = entries.reduce((sum, e) => sum + Number(e.commissionExemptAmount ?? 0), 0)
  const commissionable = grossFees - exemptAmount
  const mileageClaim   = entries.reduce(
    (sum, e) => sum + (Number(e.returnMiles ?? 0) * Number(e.mileageRate ?? 0.45)), 0
  )
  const travelExpenses = entries.reduce((sum, e) => sum + Number(e.travelExpenses ?? 0), 0)
  const subtotal       = grossFees + mileageClaim + travelExpenses
  // Commission applies to commissionable fees only (gross fees minus any exempt amounts)
  // — never to reimbursed travel, which is not part of grossFees.
  const commission     = commissionable * commissionRate

  // Reimbursed travel: billed to the client at cost (capped), on top of the fees.
  const reimbursedTravel = roundMoney(
    entries.reduce((sum, e) => sum + (reimbursement[e.id]?.billable ?? 0), 0)
  )
  // Ordinary travel shown on client invoices (unchanged legacy behaviour). Entries using
  // reimbursement are excluded: their unreimbursed/excess items are the actor's own cost.
  const otherTravel = entries.reduce(
    (sum, e) => sum + ((reimbursement[e.id]?.flagged ?? 0) > 0 ? 0 : Number(e.travelExpenses ?? 0)), 0
  )
  // What a standard client is billed: fees plus reimbursed travel at cost.
  const clientTotal = roundMoney(grossFees + reimbursedTravel)

  return {
    grossFees, exemptAmount, commissionable, mileageClaim, travelExpenses, subtotal, commission,
    reimbursedTravel, otherTravel, clientTotal,
  }
}

// Derives a short tax-year code from a period_start date string (YYYY-MM-DD).
// e.g. work in 2025-26 → "2526", work in 2026-27 → "2627"
export function taxYearCode(periodStart: string): string {
  const date  = new Date(periodStart)
  const year  = date.getFullYear()
  const month = date.getMonth() + 1  // 1-based
  const day   = date.getDate()
  // Before 6 April → previous tax year
  const startYear = (month > 4 || (month === 4 && day >= 6)) ? year : year - 1
  const endYear   = startYear + 1
  return `${String(startYear).slice(2)}${String(endYear).slice(2)}`
}

export function generateInvoiceNumber(
  type: 'client' | 'agent',
  sequenceNumber: number,
  prefix = 'INV',
  periodStart: string = new Date().toISOString().split('T')[0]
): string {
  const seq = String(sequenceNumber).padStart(3, '0')
  const pfx = type === 'client' ? prefix : 'AGT'
  return `${pfx}-${taxYearCode(periodStart)}-${seq}`
}
