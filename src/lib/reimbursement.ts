// Reimbursed travel (pass-through expenses).
//
// Some clients reimburse travel at cost up to a per-job cap. The invoice bills
// the gross amount, but the reimbursed amount is income and an expense that
// cancel out — so it is excluded from BOTH sides of the tax estimate.

export interface ReimbursableItem {
  amount: string | number | null
  reimbursed?: boolean | null
}

export interface EntryReimbursement {
  cap: number | null
  /** Sum of items ticked "reimbursed by client". */
  flagged: number
  /** Billed to the client at cost: flagged, limited to the cap (if any). */
  billable: number
  /** Flagged above the cap — not reimbursable, stays an ordinary travel expense. */
  excess: number
  /** Cap minus flagged, floored at 0. null when no cap is set. */
  headroom: number | null
}

export const roundMoney = (n: number) => Math.round(n * 100) / 100

// '' / null / negative / non-numeric → null (no cap).
export function parseCap(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function calculateReimbursement(
  items: ReimbursableItem[],
  capValue: string | number | null | undefined
): EntryReimbursement {
  const cap = parseCap(capValue)
  const flagged = roundMoney(
    items.reduce((s, i) => s + (i.reimbursed ? Number(i.amount ?? 0) : 0), 0)
  )
  const billable = cap === null ? flagged : Math.min(flagged, cap)
  return {
    cap,
    flagged,
    billable: roundMoney(billable),
    excess: roundMoney(flagged - billable),
    headroom: cap === null ? null : roundMoney(Math.max(0, cap - flagged)),
  }
}

// A journey should be claimed as mileage OR as an actual-cost reimbursed item, never both.
export function claimsMileageAndReimbursedTravel(returnMiles: number | null | undefined, flagged: number): boolean {
  return (returnMiles ?? 0) > 0 && flagged > 0
}
