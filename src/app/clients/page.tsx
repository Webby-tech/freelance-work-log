export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { getClients } from '@/lib/db/queries/clients'
import { getAgents } from '@/lib/db/queries/clients'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, User, Building } from 'lucide-react'

export default async function ClientsPage() {
  const [clients, agents] = await Promise.all([getClients(), getAgents()])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients & Agents</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/clients/new?type=agent"><Plus className="h-4 w-4 mr-1" />Agent</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/clients/new"><Plus className="h-4 w-4 mr-1" />Client</Link>
          </Button>
        </div>
      </div>

      {/* Agents */}
      {agents.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Agents</h2>
          <div className="space-y-2">
            {agents.map(a => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm">{a.name}</p>
                      {a.email && <p className="text-xs text-slate-500">{a.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {+(Number(a.commissionRate) * 100).toFixed(2)}% commission
                    </Badge>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clients/agent/${a.id}`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Clients */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Clients</h2>
        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-400">
              <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No clients yet. Add your first client to get started.</p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/clients/new">Add client</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {clients.map(c => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.type === 'payroll' ? 'default' : 'secondary'}>
                      {c.type === 'payroll' ? 'Payroll' : 'Standard'}
                    </Badge>
                    {c.agent && (
                      <span className="text-xs text-slate-400">via {c.agent.name}</span>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clients/${c.id}`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
