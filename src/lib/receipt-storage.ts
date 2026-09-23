import { del, get, head } from '@vercel/blob'
import { sniffReceiptMime } from './receipts'

// Thin wrapper over the private Vercel Blob store. Files are never reachable by URL:
// every read goes through get() with the server-side token, behind the app's auth.
// SERVER ONLY — never import this from a client component.

export function storageConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

export const STORAGE_NOT_CONFIGURED =
  'Receipt storage is not set up yet (BLOB_READ_WRITE_TOKEN is missing). See the setup steps for receipt uploads.'

// The SDK retries network failures for up to two minutes. Bound every storage call so an
// outage gives a prompt, clear error instead of a hung request: a hard time limit, plus an
// abort so the SDK stops retrying in the background.
const STORAGE_TIMEOUT_MS = 10_000

async function bounded<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('storage timeout')) }, STORAGE_TIMEOUT_MS)
  })
  try {
    return await Promise.race([run(controller.signal), timeout])
  } finally {
    clearTimeout(timer)
  }
}

// Delete files from storage. Missing files are not an error. Throws if storage can't be
// reached, so callers can stop BEFORE removing database rows (never orphan a file).
export async function deleteStoredFiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  if (!storageConfigured()) throw new Error(STORAGE_NOT_CONFIGURED)
  try {
    await bounded(signal => del(keys, { abortSignal: signal }))
  } catch {
    throw new Error("Couldn't reach receipt storage, so nothing was deleted. Please try again.")
  }
}

export interface StoredFileInfo {
  size: number
  sniffedMime: string | null
}

// Look at an uploaded file: its real size and (from its first bytes) its real type.
export async function inspectStoredFile(key: string): Promise<StoredFileInfo | null> {
  try {
    return await bounded(async signal => {
      const meta = await head(key, { abortSignal: signal }).catch(() => null)
      if (!meta) return null
      const res = await get(key, { access: 'private', useCache: false, abortSignal: signal })
      if (!res || res.statusCode !== 200 || !res.stream) return null
      // Only the first few bytes are needed to identify the file.
      const reader = res.stream.getReader()
      const first = await reader.read()
      await reader.cancel().catch(() => {})
      const firstBytes = first.value ? first.value.slice(0, 32) : new Uint8Array()
      return { size: meta.size, sniffedMime: sniffReceiptMime(firstBytes) }
    })
  } catch {
    return null
  }
}
