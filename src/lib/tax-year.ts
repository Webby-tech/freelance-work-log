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

// HMRC mileage rate: 45p for first 10,000 miles, then 25p
export const MILEAGE_RATE_STANDARD = 0.45
export const MILEAGE_RATE_REDUCED  = 0.25
export const MILEAGE_THRESHOLD     = 10_000

export function getMileageRateForYtdMiles(ytdMilesBefore: number): number {
  return ytdMilesBefore >= MILEAGE_THRESHOLD ? MILEAGE_RATE_REDUCED : MILEAGE_RATE_STANDARD
}

/**
 * Calculate total mileage allowance for a batch of miles, accounting for
 * the 10,000-mile threshold crossing mid-year.
 */
export function calculateMileageAllowance(miles: number, ytdMilesBefore: number): number {
  if (ytdMilesBefore >= MILEAGE_THRESHOLD) {
    return miles * MILEAGE_RATE_REDUCED
  }
  const standardMiles = Math.min(miles, MILEAGE_THRESHOLD - ytdMilesBefore)
  const reducedMiles  = miles - standardMiles
  return standardMiles * MILEAGE_RATE_STANDARD + reducedMiles * MILEAGE_RATE_REDUCED
}
