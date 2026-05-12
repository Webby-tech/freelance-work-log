import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { TaxEstimateResult } from '@/lib/tax-estimate'
import { netLiabilityAfterPOA } from '@/lib/tax-estimate'

interface Props {
  estimate: TaxEstimateResult
  ytdGrossFees: number
  ytdMileageClaim: number
  ytdTravelExpenses: number
  ytdAgentCommission: number
  ytdGeneralExpenses: number
  ytdAllowableExpenses: number
  priorYearTaxBill?: number | null
  poaJanPaid?: number
  poaJulPaid?: number
  useFlatRate: boolean
}

export function TaxEstimateCard({
  estimate, ytdGrossFees,
  ytdMileageClaim, ytdTravelExpenses, ytdAgentCommission, ytdGeneralExpenses,
  ytdAllowableExpenses,
  priorYearTaxBill, poaJanPaid = 0, poaJulPaid = 0,
  useFlatRate,
}: Props) {
  const { estimatedTax, marginalRate, inHigherBand, tradingProfit } = estimate
  const netLiability = netLiabilityAfterPOA(estimatedTax, poaJanPaid, poaJulPaid)

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Tax Estimate (YTD)</CardTitle>
          <Badge
            className={inHigherBand
              ? 'bg-orange-100 text-orange-800 border-orange-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
            }
          >
            Set aside {formatPercent(marginalRate)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Higher band callout */}
        {inHigherBand && (
          <div className="flex items-start gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700">
              Acting profit has crossed £37,700 — you are in the <strong>40% higher rate band</strong> on further earnings.
            </p>
          </div>
        )}

        {/* Breakdown */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between font-medium">
            <span className="text-slate-600">Gross fees (YTD)</span>
            <span>{formatCurrency(ytdGrossFees)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs pl-3">
            <span>Mileage claims</span>
            <span>−{formatCurrency(ytdMileageClaim)}</span>
          </div>
          {ytdTravelExpenses > 0 && (
            <div className="flex justify-between text-slate-500 text-xs pl-3">
              <span>Travel expenses</span>
              <span>−{formatCurrency(ytdTravelExpenses)}</span>
            </div>
          )}
          {ytdAgentCommission > 0 && (
            <div className="flex justify-between text-slate-500 text-xs pl-3">
              <span>Agent commission</span>
              <span>−{formatCurrency(ytdAgentCommission)}</span>
            </div>
          )}
          {ytdGeneralExpenses > 0 && (
            <div className="flex justify-between text-slate-500 text-xs pl-3">
              <span>General expenses</span>
              <span>−{formatCurrency(ytdGeneralExpenses)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Taxable profit</span>
            <span>{formatCurrency(tradingProfit)}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span>Estimated tax @ {formatPercent(marginalRate)}{useFlatRate ? ' (flat)' : ''}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(estimatedTax)}</span>
          </div>
        </div>

        {/* POA context */}
        {priorYearTaxBill != null && priorYearTaxBill > 0 && (
          <>
            <Separator />
            <div className="text-xs text-slate-500 space-y-0.5">
              <div className="flex justify-between">
                <span>POA paid (Jan + Jul)</span>
                <span>{formatCurrency(poaJanPaid + poaJulPaid)}</span>
              </div>
              <div className="flex justify-between font-medium text-slate-700">
                <span>Est. balance due Jan 31</span>
                <span>{formatCurrency(netLiability)}</span>
              </div>
              <p className="text-slate-400 pt-1">Based on prior year bill — confirm with your accountant.</p>
            </div>
          </>
        )}

        <Separator />
        {/* Permanent note — no NI, PA exhausted */}
        <p className="text-xs text-slate-400 leading-relaxed">
          Personal allowance used by pension income — acting income taxable from £1. No NI (age 67).
        </p>
      </CardContent>
    </Card>
  )
}
