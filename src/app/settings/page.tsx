export const dynamic = 'force-dynamic'
import { getSettings } from '@/lib/db/queries/settings'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const settings = await getSettings()
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Your personal details, bank info, and tax preferences.</p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  )
}
