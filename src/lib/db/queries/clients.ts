import { supabaseAdmin } from '../index'
import type { Client, Agent, NewClient, NewAgent } from '../schema'
import { fromDb, toDb } from '../mappers'

export type ClientWithAgent = Client & { agent: Agent | null }

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<Agent[]> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data as unknown[]).map(row => fromDb<Agent>(row))
}

export async function getAgent(id: string): Promise<Agent | null> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error) return null
  return fromDb<Agent>(data)
}

export async function createAgent(values: Omit<NewAgent, 'id' | 'createdAt'>): Promise<Agent> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .insert(toDb(values))
    .select()
    .single()
  if (error) throw error
  return fromDb<Agent>(data)
}

export async function updateAgent(id: string, values: Partial<Agent>): Promise<Agent> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .update(toDb(values))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb<Agent>(data)
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function getClients(): Promise<ClientWithAgent[]> {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, agent:agents(*)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data as unknown[]).map(row => fromDb<ClientWithAgent>(row))
}

export async function getClient(id: string): Promise<ClientWithAgent | null> {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, agent:agents(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error) return null
  return fromDb<ClientWithAgent>(data)
}

export async function createClient(values: Omit<NewClient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert(toDb(values))
    .select()
    .single()
  if (error) throw error
  return fromDb<Client>(data)
}

export async function updateClient(id: string, values: Partial<Client>): Promise<Client> {
  const dbValues = toDb(values) as Record<string, unknown>
  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({ ...dbValues, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb<Client>(data)
}

export async function softDeleteClient(id: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from('work_entries')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)
    .is('invoice_id', null)
  if (count && count > 0) {
    throw new Error('Cannot delete client with uninvoiced entries. Invoice or reassign them first.')
  }
  const { error } = await supabaseAdmin
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
