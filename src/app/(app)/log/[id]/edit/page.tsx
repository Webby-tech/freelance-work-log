export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { getEntry } from '@/lib/db/queries/entries'
import { getClients } from '@/lib/db/queries/clients'
import { getSettings } from '@/lib/db/queries/settings'
import { getTravelExpenseItems } from '@/lib/db/queries/travel-expenses'
import { getReceiptsForParents } from '@/lib/db/queries/receipts'
import { formatCurrency } from '@/lib/utils'
import { EntryForm } from '@/components/work-entry/EntryForm'
import { ReceiptAttachments } from '@/components/receipts/ReceiptAttachments'
import { ReceiptBadge } from '@/components/receipts/ReceiptBadge'
import { Card, CardContent } from '@/components/ui/card'

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [entry, clients, settings] = await Promise.all([
    getEntry(id), getClients(), getSettings(),
  ])
  if (!entry || !settings) notFound()

  const travelItems = await getTravelExpenseItems(id)
  const itemReceipts = await getReceiptsForParents('travel_expense_item', travelItems.map(i => i.id))

  if (entry.invoiceId) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-5">
        <p className="text-amber-600">This entry is locked to an invoice. Void the invoice to edit it.</p>
        {travelItems.length > 0 && (
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-sm font-medium">Receipts for travel expenses</p>
                <p className="text-xs text-slate-500">You can add receipts to an invoiced entry, but existing receipts can&apos;t be removed.</p>
              </div>
              {travelItems.map(item => (
                <div key={item.id} className="space-y-1.5 border-t pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {item.description}
                      {item.reimbursed && <span className="ml-1 text-xs text-slate-400">(reimbursed by client)</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ReceiptBadge count={itemReceipts[item.id]?.length ?? 0} />
                      <span className="font-medium">{formatCurrency(Number(item.amount))}</span>
                    </span>
                  </div>
                  <ReceiptAttachments
                    parentType="travel_expense_item"
                    parentId={item.id}
                    receipts={itemReceipts[item.id] ?? []}
                    canDelete={false}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Entry</h1>
      <EntryForm
        clients={clients}
        settings={settings}
        existing={entry}
        existingTravelItems={travelItems.map(i => ({ id: i.id, description: i.description, amount: String(i.amount), reimbursed: i.reimbursed }))}
        itemReceipts={itemReceipts}
      />
    </div>
  )
}
