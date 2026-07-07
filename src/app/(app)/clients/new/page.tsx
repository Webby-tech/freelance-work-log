export const dynamic = 'force-dynamic'
import { getAgents } from '@/lib/db/queries/clients'
import { ClientForm } from '../ClientForm'

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const isAgent = params.type === 'agent'
  const agents = isAgent ? [] : await getAgents()

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{isAgent ? 'New Agent' : 'New Client'}</h1>
      <ClientForm agents={agents} isAgent={isAgent} />
    </div>
  )
}
