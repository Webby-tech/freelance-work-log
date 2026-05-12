export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { getEntry } from '@/lib/db/queries/entries'
import { getClients } from '@/lib/db/queries/clients'
import { getSettings } from '@/lib/db/queries/settings'
import { getTravelExpenseItems } from '@/lib/db/queries/travel-expenses'
import { EntryForm } from '@/components/work-entry/EntryForm'

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [entry, clients, settings] = await Promise.all([
    getEntry(id), getClients(), getSettings(),
  ])
  if (!entry || !settings) notFound()

  if (entry.invoiceId) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-amber-600">This entry is locked to an invoice. Void the invoice to edit it.</p>
      </div>
    )
  }

  const travelItems = await getTravelExpenseItems(id)

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Entry</h1>
      <EntryForm
        clients={clients}
        settings={settings}
        existing={entry}
        existingTravelItems={travelItems.map(i => ({ description: i.description, amount: String(i.amount) }))}
      />
    </div>
  )
}
