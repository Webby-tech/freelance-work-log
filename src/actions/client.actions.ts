'use server'
import { revalidatePath } from 'next/cache'
import {
  createClient, updateClient, softDeleteClient,
  createAgent, updateAgent, deleteAgent,
} from '@/lib/db/queries/clients'

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function createClientAction(values: {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  type: 'standard' | 'payroll'
  agentId?: string | null
}) {
  const client = await createClient({
    name: values.name,
    email: values.email ?? null,
    phone: values.phone ?? null,
    address: values.address ?? null,
    type: values.type,
    agentId: values.agentId ?? null,
  })
  revalidatePath('/clients')
  return client
}

export async function updateClientAction(id: string, values: {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  type?: 'standard' | 'payroll'
  agentId?: string | null
}) {
  const client = await updateClient(id, {
    name: values.name,
    email: values.email,
    phone: values.phone,
    address: values.address,
    type: values.type,
    agentId: values.agentId,
  })
  revalidatePath('/clients', 'layout')
  return client
}

export async function deleteClientAction(id: string) {
  await softDeleteClient(id)
  revalidatePath('/clients')
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function createAgentAction(values: {
  name: string
  email?: string | null
  address?: string | null
  commissionRate?: string
  vatRegistered?: boolean
}) {
  const agent = await createAgent({
    name: values.name,
    email: values.email ?? null,
    address: values.address ?? null,
    commissionRate: values.commissionRate ?? '0.125',
    vatRegistered: values.vatRegistered ?? false,
  })
  revalidatePath('/clients')
  return agent
}

export async function updateAgentAction(id: string, values: {
  name?: string
  email?: string | null
  address?: string | null
  commissionRate?: string
  vatRegistered?: boolean
}) {
  const agent = await updateAgent(id, {
    name: values.name,
    email: values.email,
    address: values.address,
    commissionRate: values.commissionRate,
    vatRegistered: values.vatRegistered,
  })
  revalidatePath('/clients')
  return agent
}

export async function deleteAgentAction(id: string) {
  await deleteAgent(id)
  revalidatePath('/clients')
}
