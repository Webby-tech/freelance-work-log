'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Agent, Client } from '@/lib/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  createClientAction, updateClientAction, deleteClientAction,
  createAgentAction, updateAgentAction, deleteAgentAction,
} from '@/actions/client.actions'

type ClientWithAgent = Client & { agent: Agent | null }

interface Props {
  agents: Agent[]
  existing?: ClientWithAgent | Agent
  isAgent?: boolean
}

export function ClientForm({ agents, existing, isAgent = false }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const existingAgent = isAgent ? (existing as Agent) : null
  const existingClient = !isAgent ? (existing as ClientWithAgent) : null

  const [name,    setName]    = useState(existing?.name    ?? '')
  const [email,   setEmail]   = useState(existing?.email   ?? '')
  const [phone,   setPhone]   = useState((existing as Client)?.phone ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [type,    setType]    = useState<'standard' | 'payroll'>(existingClient?.type ?? 'standard')
  const [agentId, setAgentId] = useState(existingClient?.agentId ?? '')
  const [commissionRate, setCommissionRate] = useState(
    existingAgent?.commissionRate
      ? String(Math.round(Number(existingAgent.commissionRate) * 100 * 10) / 10)
      : '12.5'
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (isAgent) {
        const payload = {
          name,
          email: email || null,
          address: address || null,
          commissionRate: String(Number(commissionRate) / 100),
        }
        if (existingAgent) {
          await updateAgentAction(existingAgent.id, payload)
        } else {
          await createAgentAction(payload)
        }
      } else {
        const payload = {
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          type,
          agentId: (type === 'payroll' && agentId) ? agentId : null,
        }
        if (existingClient) {
          await updateClientAction(existingClient.id, payload)
        } else {
          await createClientAction(payload)
        }
      }
      toast.success(existing ? 'Updated' : 'Created')
      router.refresh()
      router.push('/clients')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm(`Delete ${existing.name}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      if (isAgent && existingAgent) {
        await deleteAgentAction(existingAgent.id)
      } else if (existingClient) {
        await deleteClientAction(existingClient.id)
      }
      toast.success('Deleted')
      router.push('/clients')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div>
            <Label className="text-xs">{isAgent ? 'Agency name' : 'Client name'} *</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input className="mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {!isAgent && (
            <div>
              <Label className="text-xs">Phone</Label>
              <Input className="mt-1" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="For invoice header" />
            </div>
          )}
          <div>
            <Label className="text-xs">Address</Label>
            <Input className="mt-1" value={address} onChange={e => setAddress(e.target.value)} placeholder="For invoice header" />
          </div>

          {!isAgent && (
            <>
              <Separator />
              <div>
                <Label className="text-xs">Client type *</Label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as 'standard' | 'payroll')}
                  className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="standard">Standard — you invoice them directly</option>
                  <option value="payroll">Payroll — they pay gross, agent invoices you for commission</option>
                </select>
              </div>

              {type === 'payroll' && agents.length > 0 && (
                <div>
                  <Label className="text-xs">Agent</Label>
                  <select
                    value={agentId ?? ''}
                    onChange={e => setAgentId(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select agent…</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {type === 'payroll' && agents.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                  No agents found. Add an agent first to link a payroll client.
                </p>
              )}
            </>
          )}

          {isAgent && (
            <>
              <Separator />
              <div>
                <Label className="text-xs">Commission rate (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number" min="0" max="100" step="0.1"
                    value={commissionRate}
                    onChange={e => setCommissionRate(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Commission applies to fees only, not mileage or travel expenses.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Saving…' : existing ? 'Save changes' : `Create ${isAgent ? 'agent' : 'client'}`}
        </Button>
        {existing && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </div>
    </form>
  )
}
