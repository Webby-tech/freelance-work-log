'use server'
import { revalidatePath } from 'next/cache'
import { upsertSettings } from '@/lib/db/queries/settings'
import type { UserSettings } from '@/lib/db/schema'

export async function updateSettingsAction(values: Partial<UserSettings>) {
  await upsertSettings(values)
  revalidatePath('/', 'layout')
}
