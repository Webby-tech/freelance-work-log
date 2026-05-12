// 2024/25 UK Income Tax bands — no NI (user is 67, past state pension age)
const PERSONAL_ALLOWANCE = 12_570
const BASIC_RATE_LIMIT   = 50_270  // 20% on income above PA up to here
const HIGHER_RATE_LIMIT  = 125_140 // 45% above this

export type TaxBand = 'tax-free' | 'basic' | 'higher' | 'additional'

export interface TaxEstimateInput {
  ytdGrossFees:               number
  ytdAllowableExpenses:       number
  personalAllowanceExhausted: boolean
  useFlatRate:                boolean
  flatRateOverride:           number
}

export interface TaxEstimateResult {
  tradingProfit:     number
  taxableProfit:     number
  estimatedTax:      number
  effectiveRate:     number
  marginalRate:      number
  suggestedSetAside: number
  band:              TaxBand
  inHigherBand:      boolean  // true when profit > £37,700 (basic band width)
}

const BASIC_BAND_WIDTH  = BASIC_RATE_LIMIT  - PERSONAL_ALLOWANCE  // £37,700
const HIGHER_BAND_WIDTH = HIGHER_RATE_LIMIT - BASIC_RATE_LIMIT     // £74,870

export function estimateTax(input: TaxEstimateInput): TaxEstimateResult {
  const { ytdGrossFees, ytdAllowableExpenses,
          personalAllowanceExhausted, useFlatRate, flatRateOverride } = input

  const tradingProfit = Math.max(ytdGrossFees - ytdAllowableExpenses, 0)

  const taxableProfit = personalAllowanceExhausted
    ? tradingProfit
    : Math.max(tradingProfit - PERSONAL_ALLOWANCE, 0)

  let estimatedTax: number
  let marginalRate: number

  if (useFlatRate) {
    estimatedTax = tradingProfit * flatRateOverride
    marginalRate  = flatRateOverride
  } else {
    estimatedTax = bandedTax(taxableProfit)
    marginalRate  = nextPoundRate(taxableProfit)
  }

  const effectiveRate = tradingProfit > 0 ? estimatedTax / tradingProfit : 0

  return {
    tradingProfit,
    taxableProfit,
    estimatedTax,
    effectiveRate,
    marginalRate,
    suggestedSetAside: marginalRate,
    band: getBand(taxableProfit),
    inHigherBand: taxableProfit >= BASIC_BAND_WIDTH,
  }
}

function bandedTax(taxableProfit: number): number {
  if (taxableProfit <= 0) return 0
  let tax = 0
  const basic  = Math.min(taxableProfit, BASIC_BAND_WIDTH)
  if (basic  > 0) tax += basic  * 0.20
  const higher = Math.min(Math.max(taxableProfit - BASIC_BAND_WIDTH, 0), HIGHER_BAND_WIDTH)
  if (higher > 0) tax += higher * 0.40
  const add    = Math.max(taxableProfit - BASIC_BAND_WIDTH - HIGHER_BAND_WIDTH, 0)
  if (add    > 0) tax += add    * 0.45
  return tax
}

function nextPoundRate(taxableProfit: number): number {
  if (taxableProfit < BASIC_BAND_WIDTH)  return 0.20
  if (taxableProfit < HIGHER_RATE_LIMIT - PERSONAL_ALLOWANCE) return 0.40
  return 0.45
}

function getBand(taxableProfit: number): TaxBand {
  if (taxableProfit <= 0)               return 'tax-free'
  if (taxableProfit < BASIC_BAND_WIDTH) return 'basic'
  if (taxableProfit < HIGHER_RATE_LIMIT - PERSONAL_ALLOWANCE) return 'higher'
  return 'additional'
}

export function netLiabilityAfterPOA(
  estimatedTax: number,
  poaJanPaid:   number,
  poaJulPaid:   number,
): number {
  return Math.max(estimatedTax - poaJanPaid - poaJulPaid, 0)
}
