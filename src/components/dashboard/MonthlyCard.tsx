import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface Props {
  month: string       // e.g. "May 2025"
  grossFees: number
  mileageClaim: number
  travelExpenses: number
  entryCount: number
}

export function MonthlyCard({ month, grossFees, mileageClaim, travelExpenses, entryCount }: Props) {
  const total = grossFees
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">{month}</p>
          <p className="font-bold text-sm">{formatCurrency(total)}</p>
        </div>
        <div className="text-xs text-slate-500 space-y-0.5">
          {grossFees > 0    && <div className="flex justify-between"><span>Fees</span><span>{formatCurrency(grossFees)}</span></div>}
          {mileageClaim > 0 && <div className="flex justify-between"><span>Mileage</span><span>{formatCurrency(mileageClaim)}</span></div>}
          {travelExpenses>0 && <div className="flex justify-between"><span>Travel</span><span>{formatCurrency(travelExpenses)}</span></div>}
          <div className="flex justify-between text-slate-400 pt-0.5">
            <span>{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
