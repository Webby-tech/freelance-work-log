import { supabaseAdmin } from '../index'
import type { UserSettings } from '../schema'
import { fromDb, toDb } from '../mappers'

export async function getSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('user_settings')
    .select('*')
    .limit(1)
    .single()
  if (error) return null
  return fromDb<UserSettings>(data)
}

export async function upsertSettings(values: Partial<UserSettings>): Promise<UserSettings> {
  const existing = await getSettings()
  const dbValues = toDb(values) as Record<string, unknown>
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .update({ ...dbValues, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return fromDb<UserSettings>(data)
  } else {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .insert(dbValues)
      .select()
      .single()
    if (error) throw error
    return fromDb<UserSettings>(data)
  }
}
