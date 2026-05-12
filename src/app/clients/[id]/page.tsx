export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { getClient, getAgents } from '@/lib/db/queries/clients'
import { ClientForm } from '../ClientForm'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [client, agents] = await Promise.all([getClient(id), getAgents()])
  if (!client) notFound()

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Client</h1>
      <ClientForm agents={agents} existing={client} />
    </div>
  )
}
