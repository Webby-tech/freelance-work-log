import type { WorkEntry } from './db/schema'

export function calculateInvoiceTotals(
  entries: WorkEntry[],
  commissionRate = 0.125
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
  const commission     = commissionable * commissionRate
  return { grossFees, exemptAmount, commissionable, mileageClaim, travelExpenses, subtotal, commission }
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
