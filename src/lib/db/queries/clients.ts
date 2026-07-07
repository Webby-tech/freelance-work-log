import { and, count, eq, isNull } from 'drizzle-orm'
import { db } from '../index'
import { agents, clients, workEntries } from '../schema'
import type { Client, Agent, NewClient, NewAgent } from '../schema'

export type ClientWithAgent = Client & { agent: Agent | null }

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<Agent[]> {
  return db.select().from(agents).where(isNull(agents.deletedAt)).orderBy(agents.name)
}

export async function getAgent(id: string): Promise<Agent | null> {
  const rows = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), isNull(agents.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

export async function createAgent(values: Omit<NewAgent, 'id' | 'createdAt'>): Promise<Agent> {
  const [agent] = await db.insert(agents).values(values).returning()
  return agent
}

export async function updateAgent(id: string, values: Partial<Agent>): Promise<Agent> {
  const [agent] = await db.update(agents).set(values).where(eq(agents.id, id)).returning()
  return agent
}

export async function deleteAgent(id: string): Promise<void> {
  await db.update(agents).set({ deletedAt: new Date() }).where(eq(agents.id, id))
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function getClients(): Promise<ClientWithAgent[]> {
  return db.query.clients.findMany({
    where: isNull(clients.deletedAt),
    orderBy: clients.name,
    with: { agent: true },
  })
}

export async function getClient(id: string): Promise<ClientWithAgent | null> {
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), isNull(clients.deletedAt)),
    with: { agent: true },
  })
  return client ?? null
}

export async function createClient(values: Omit<NewClient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
  const [client] = await db.insert(clients).values(values).returning()
  return client
}

export async function updateClient(id: string, values: Partial<Client>): Promise<Client> {
  const [client] = await db
    .update(clients)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning()
  return client
}

export async function softDeleteClient(id: string): Promise<void> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(workEntries)
    .where(and(eq(workEntries.clientId, id), isNull(workEntries.invoiceId)))
  if (value > 0) {
    throw new Error('Cannot delete client with uninvoiced entries. Invoice or reassign them first.')
  }
  await db.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, id))
}
