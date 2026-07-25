// UK tax year runs 6 April → 5 April the following year

export interface TaxYear {
  start: Date
  end: Date
  label: string  // e.g. "2025/26"
}

export function getTaxYearForDate(date: Date): TaxYear {
  const year = date.getFullYear()
  const month = date.getMonth() + 1  // 1-based
  const day = date.getDate()

  // Before 6 April → previous tax year
  const inNewYear = month > 4 || (month === 4 && day >= 6)
  const startYear = inNewYear ? year : year - 1

  return {
    start: new Date(startYear, 3, 6),       // 6 April (month index 3)
    end:   new Date(startYear + 1, 3, 5),   // 5 April next year
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
  }
}

export function getCurrentTaxYear(): TaxYear {
  return getTaxYearForDate(new Date())
}

export function isInCurrentTaxYear(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const { start, end } = getCurrentTaxYear()
  return d >= start && d <= end
}

export function isInSameTaxYear(a: Date | string, b: Date | string): boolean {
  const da = typeof a === 'string' ? new Date(a) : a
  const db = typeof b === 'string' ? new Date(b) : b
  const yearA = getTaxYearForDate(da)
  const yearB = getTaxYearForDate(db)
  return yearA.label === yearB.label
}

export function formatTaxYearDates(taxYear: TaxYear): string {
  return `6 Apr ${taxYear.start.getFullYear()} – 5 Apr ${taxYear.end.getFullYear()}`
}

// HMRC mileage rate: a standard rate for the first 10,000 business miles in a
// tax year, then a reduced rate above that. The reduced rate has stayed at 25p
// throughout; the standard rate is effective-dated below (45p, then 55p from
// the 2026/27 tax year — 6 April 2026).
export const MILEAGE_RATE_REDUCED = 0.25
export const MILEAGE_THRESHOLD    = 10_000

const MILEAGE_STANDARD_RATE_SCHEDULE: { effectiveFrom: string; rate: number }[] = [
  { effectiveFrom: '2000-01-01', rate: 0.45 },
  { effectiveFrom: '2026-04-06', rate: 0.55 },
]

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Returns the standard mileage rate in effect for a given date (YYYY-MM-DD or Date).
// Date objects are formatted from their local calendar fields, not via
// toISOString() — that converts to UTC and can shift the date backward by a
// day in BST, which would misclassify entries right at the 6 April boundary.
export function getStandardMileageRateForDate(date: Date | string): number {
  const iso = typeof date === 'string' ? date : toLocalIsoDate(date)
  let rate = MILEAGE_STANDARD_RATE_SCHEDULE[0].rate
  for (const entry of MILEAGE_STANDARD_RATE_SCHEDULE) {
    if (iso >= entry.effectiveFrom) rate = entry.rate
  }
  return rate
}

// The standard mileage rate never changes mid-tax-year, so the tax year's
// start date (6 April) is enough to resolve the rate for the whole year.
export function getStandardMileageRateForTaxYear(taxYear: TaxYear): number {
  return getStandardMileageRateForDate(taxYear.start)
}

export function getMileageRateForYtdMiles(ytdMilesBefore: number, standardRate: number): number {
  return ytdMilesBefore >= MILEAGE_THRESHOLD ? MILEAGE_RATE_REDUCED : standardRate
}

/**
 * Calculate total mileage allowance for a batch of miles, accounting for
 * the 10,000-mile threshold crossing mid-year.
 */
export function calculateMileageAllowance(miles: number, ytdMilesBefore: number, standardRate: number): number {
  if (ytdMilesBefore >= MILEAGE_THRESHOLD) {
    return miles * MILEAGE_RATE_REDUCED
  }
  const standardMiles = Math.min(miles, MILEAGE_THRESHOLD - ytdMilesBefore)
  const reducedMiles  = miles - standardMiles
  return standardMiles * standardRate + reducedMiles * MILEAGE_RATE_REDUCED
}
