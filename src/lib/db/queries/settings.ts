import { eq } from 'drizzle-orm'
import { db } from '../index'
import { userSettings } from '../schema'
import type { UserSettings } from '../schema'

export async function getSettings(): Promise<UserSettings | null> {
  const rows = await db.select().from(userSettings).limit(1)
  return rows[0] ?? null
}

export async function upsertSettings(values: Partial<UserSettings>): Promise<UserSettings> {
  const existing = await getSettings()
  if (existing) {
    const [settings] = await db
      .update(userSettings)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(userSettings.id, existing.id))
      .returning()
    return settings
  } else {
    const [settings] = await db.insert(userSettings).values(values).returning()
    return settings
  }
}
