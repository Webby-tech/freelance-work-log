export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { getAgent } from '@/lib/db/queries/clients'
import { ClientForm } from '../../ClientForm'

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = await getAgent(id)
  if (!agent) notFound()

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Agent</h1>
      <ClientForm agents={[]} existing={agent} isAgent />
    </div>
  )
}
