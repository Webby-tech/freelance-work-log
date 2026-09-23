'use server'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import {
  ALLOWED_RECEIPT_MIMES, MAX_RECEIPT_BYTES, checkUploadRequest, isParentType, isUuid,
  receiptKeyPrefix, sanitizeFilename, validateReceiptFile,
} from '@/lib/receipts'
import { STORAGE_NOT_CONFIGURED, deleteStoredFiles, inspectStoredFile, storageConfigured } from '@/lib/receipt-storage'
import {
  deleteReceiptRow, getReceipt, insertReceipt, isParentLocked, parentExists, toReceiptView, type ReceiptView,
} from '@/lib/db/queries/receipts'

// Results are returned (not thrown): in production Next.js hides thrown error messages
// from the browser, and every one of these has a message the user needs to read.
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function refresh() {
  for (const p of ['/', '/log', '/receipts', '/reports']) revalidatePath(p)
}

async function authed(): Promise<string | null> {
  try { await requireAuth(); return null } catch { return 'Not signed in.' }
}

// Called by the browser when an upload fails: the upload SDK only reports a generic
// error, so this re-runs the server's own checks to say WHY (bad type, too big, …).
export async function checkReceiptUploadAction(meta: unknown): Promise<Result> {
  const denied = await authed()
  if (denied) return { ok: false, error: denied }
  if (!storageConfigured()) return { ok: false, error: STORAGE_NOT_CONFIGURED }
  const check = checkUploadRequest(meta)
  if (!check.ok) return check
  if (!(await parentExists(check.meta.parentType, check.meta.parentId))) {
    return { ok: false, error: 'That expense no longer exists.' }
  }
  return { ok: true }
}

// Called by the browser after the file has been uploaded straight to storage. Nothing the
// browser says is trusted: the stored file is re-inspected (real size, real type from its
// first bytes) and removed again if it doesn't pass.
export async function registerReceiptAction(input: {
  parentType: string
  parentId: string
  pathname: string
  originalFilename: string
}): Promise<Result<{ receipt: ReceiptView }>> {
  const denied = await authed()
  if (denied) return { ok: false, error: denied }
  if (!storageConfigured()) return { ok: false, error: STORAGE_NOT_CONFIGURED }

  const { parentType, parentId, pathname } = input
  if (!isParentType(parentType) || !isUuid(parentId)) return { ok: false, error: 'Invalid receipt details.' }
  // The file must sit under this expense's own folder in storage
  if (typeof pathname !== 'string' || !pathname.startsWith(receiptKeyPrefix(parentType, parentId)) || pathname.includes('..')) {
    return { ok: false, error: 'Invalid receipt details.' }
  }

  const discard = () => deleteStoredFiles([pathname]).catch(() => {})

  if (!(await parentExists(parentType, parentId))) {
    await discard()
    return { ok: false, error: 'That expense no longer exists.' }
  }

  const info = await inspectStoredFile(pathname)
  if (!info) return { ok: false, error: 'The uploaded file could not be found. Please try again.' }
  if (info.size > MAX_RECEIPT_BYTES) {
    await discard()
    return { ok: false, error: `That file is larger than ${MAX_RECEIPT_BYTES / 1024 / 1024} MB.` }
  }
  if (!info.sniffedMime || !ALLOWED_RECEIPT_MIMES.includes(info.sniffedMime)) {
    await discard()
    return { ok: false, error: "That file isn't a real PDF, JPEG, PNG or WebP, so it wasn't attached." }
  }
  const named = validateReceiptFile({ name: input.originalFilename, type: info.sniffedMime, size: info.size })
  if (!named.ok) {
    await discard()
    return named
  }

  try {
    const row = await insertReceipt({
      parentType,
      parentId,
      storageKey: pathname,
      originalFilename: sanitizeFilename(input.originalFilename),
      mimeType: info.sniffedMime,
      sizeBytes: info.size,
    })
    refresh()
    return { ok: true, receipt: toReceiptView(row) }
  } catch {
    // e.g. the same stored file registered twice
    return { ok: false, error: 'That receipt could not be saved. Please try again.' }
  }
}

export async function deleteReceiptAction(id: string): Promise<Result> {
  const denied = await authed()
  if (denied) return { ok: false, error: denied }
  if (!isUuid(id)) return { ok: false, error: 'Receipt not found.' }

  const receipt = await getReceipt(id)
  if (!receipt) return { ok: false, error: 'Receipt not found.' }
  if (await isParentLocked(receipt.parentType, receipt.parentId)) {
    return { ok: false, error: "This entry has been invoiced, so its receipts can't be removed. (You can still add more.)" }
  }

  try {
    await deleteStoredFiles([receipt.storageKey])   // file first: if this fails, nothing changes
  } catch (e) {
    return { ok: false, error: `Couldn't delete the file from storage: ${(e as Error).message}` }
  }
  await deleteReceiptRow(id)
  refresh()
  return { ok: true }
}
