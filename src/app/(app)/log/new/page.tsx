export const dynamic = 'force-dynamic'
import { getClients } from '@/lib/db/queries/clients'
import { getSettings } from '@/lib/db/queries/settings'
import { EntryForm } from '@/components/work-entry/EntryForm'

export default async function NewEntryPage() {
  const [clients, settings] = await Promise.all([getClients(), getSettings()])

  if (!settings) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-amber-600">Please complete your <a href="/settings" className="underline">Settings</a> before logging work.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">New Work Entry</h1>
      <EntryForm clients={clients} settings={settings} />
    </div>
  )
}
