export const dynamic = 'force-dynamic'
import { getClients } from '@/lib/db/queries/clients'
import { getSettings } from '@/lib/db/queries/settings'
import { InvoiceWizard } from './InvoiceWizard'

export default async function GenerateInvoicePage() {
  const [clients, settings] = await Promise.all([getClients(), getSettings()])

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Generate Invoice</h1>
      <InvoiceWizard clients={clients} settings={settings} />
    </div>
  )
}
