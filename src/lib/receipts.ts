// Receipt uploads: shared rules used by BOTH the browser (for instant, friendly errors)
// and the server (the authority — it re-checks everything when issuing the upload token
// and again when the upload is registered). Pure functions only; no storage/DB access.

import type { ReceiptParentType } from './db/schema'

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 // 10 MB per file

// Accepted types. HEIC/HEIF are stored but can't be previewed in most browsers.
const EXT_TO_MIME: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

export const ALLOWED_RECEIPT_MIMES = Array.from(new Set(Object.values(EXT_TO_MIME)))

export const PARENT_TYPES: ReceiptParentType[] = ['professional_expense', 'travel_expense_item']

export function isParentType(v: unknown): v is ReceiptParentType {
  return typeof v === 'string' && (PARENT_TYPES as string[]).includes(v)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Strip any path, control characters and anything outside a conservative set; keep the
// extension; cap the length. Never returns an empty string.
export function sanitizeFilename(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').normalize('NFC')
  const dot = base.lastIndexOf('.')
  const rawStem = dot > 0 ? base.slice(0, dot) : base
  const rawExt = dot > 0 ? base.slice(dot + 1) : ''
  const clean = (s: string) =>
    s.replace(/[^A-Za-z0-9._ ()\-]/g, '_').replace(/\s+/g, ' ').replace(/^[.\s_]+|[.\s]+$/g, '')
  const stem = clean(rawStem).slice(0, 80) || 'receipt'
  const ext = clean(rawExt).replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 5)
  return ext ? `${stem}.${ext}` : stem
}

const normaliseMime = (m: string) => {
  const t = m.toLowerCase().trim()
  if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg'
  if (t === 'image/heic-sequence') return 'image/heic'
  if (t === 'image/heif-sequence') return 'image/heif'
  return t
}
// HEIC and HEIF are the same family; a phone may label either.
const sameMimeFamily = (a: string, b: string) =>
  a === b || (a.startsWith('image/he') && b.startsWith('image/he'))

export type FileCheck =
  | { ok: true; mime: string; safeName: string }
  | { ok: false; error: string }

export function validateReceiptFile(file: { name: string; type?: string | null; size: number }): FileCheck {
  const safeName = sanitizeFilename(file.name)
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: `"${safeName}" is empty. Choose a different file.` }
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return {
      ok: false,
      error: `"${safeName}" is ${formatFileSize(file.size)} — receipts can be at most ${formatFileSize(MAX_RECEIPT_BYTES)}. Re-scan at a lower quality or choose a smaller file.`,
    }
  }
  const ext = safeName.includes('.') ? safeName.split('.').pop()!.toLowerCase() : ''
  const mime = EXT_TO_MIME[ext]
  if (!mime) {
    return {
      ok: false,
      error: `"${safeName}" isn't an accepted file type${ext ? ` (.${ext})` : ''}. Attach a PDF, JPEG, PNG or WebP.`,
    }
  }
  const declared = file.type ? normaliseMime(file.type) : ''
  if (declared && declared !== 'application/octet-stream' && !sameMimeFamily(declared, mime)) {
    return { ok: false, error: `"${safeName}" doesn't look like a ${ext.toUpperCase()} file (its type is ${declared}). Attach a PDF, JPEG, PNG or WebP.` }
  }
  return { ok: true, mime, safeName }
}

// Identify a file from its first bytes — the browser-supplied type is never trusted alone.
export function sniffReceiptMime(bytes: Uint8Array): string | null {
  const at = (i: number) => bytes[i]
  const ascii = (start: number, s: string) => s.split('').every((c, i) => at(start + i) === c.charCodeAt(0))
  if (bytes.length >= 5 && ascii(0, '%PDF-')) return 'application/pdf'
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && at(0) === 0x89 && ascii(1, 'PNG') && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return 'image/png'
  if (bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  if (bytes.length >= 12 && ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11))
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs'].includes(brand)) return 'image/heic'
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif'
  }
  return null
}

// Browsers can show these inline as a thumbnail; PDFs open in the browser's viewer.
export const isImageMime = (m: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(m)
export const isPdfMime = (m: string) => m === 'application/pdf'
export const isViewableInBrowser = (m: string) => isImageMime(m) || isPdfMime(m)

// ── Storage keys ──────────────────────────────────────────────────────────────

export const receiptKeyPrefix = (type: ReceiptParentType, parentId: string) =>
  `receipts/${type}/${parentId}/`

export function receiptPathname(type: ReceiptParentType, parentId: string, safeName: string) {
  return `${receiptKeyPrefix(type, parentId)}${safeName}`
}

// What the browser tells the server when asking to upload (a JSON string, since the
// upload SDK carries `clientPayload` as a string).
export interface UploadRequestMeta {
  parentType: ReceiptParentType
  parentId: string
  filename: string
  contentType: string
  size: number
}

export type MetaCheck =
  | { ok: true; meta: UploadRequestMeta; mime: string; safeName: string; pathname: string }
  | { ok: false; error: string }

// Shape + rules check for an upload request. (Whether the parent exists is a DB check
// done by the server on top of this.)
export function checkUploadRequest(raw: unknown): MetaCheck {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid upload request.' }
  const m = raw as Record<string, unknown>
  if (!isParentType(m.parentType)) return { ok: false, error: 'Invalid upload request (unknown expense type).' }
  if (!isUuid(m.parentId)) return { ok: false, error: 'Invalid upload request (bad expense id).' }
  if (typeof m.filename !== 'string' || typeof m.size !== 'number') return { ok: false, error: 'Invalid upload request.' }
  const check = validateReceiptFile({ name: m.filename, type: typeof m.contentType === 'string' ? m.contentType : '', size: m.size })
  if (!check.ok) return check
  return {
    ok: true,
    meta: { parentType: m.parentType, parentId: m.parentId, filename: m.filename, contentType: check.mime, size: m.size },
    mime: check.mime,
    safeName: check.safeName,
    pathname: receiptPathname(m.parentType, m.parentId, check.safeName),
  }
}
