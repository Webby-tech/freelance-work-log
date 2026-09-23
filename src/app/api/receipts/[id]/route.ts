import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { isValidAuthCookie } from '@/lib/auth'
import { isUuid, isViewableInBrowser } from '@/lib/receipts'
import { STORAGE_NOT_CONFIGURED, storageConfigured } from '@/lib/receipt-storage'
import { getReceipt } from '@/lib/db/queries/receipts'

// Serves a receipt. The file lives in PRIVATE storage with no public URL, so this
// authenticated route is the only way to read it: it checks the password cookie itself
// (in addition to the middleware), fetches the file with the server-side token and
// streams it. PDFs and images open inline in the browser; other types download.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isValidAuthCookie(request.cookies.get('auth')?.value)) {
    return new NextResponse('Not signed in', { status: 401 })
  }
  if (!isUuid(params.id)) return new NextResponse('Not found', { status: 404 })
  if (!storageConfigured()) return new NextResponse(STORAGE_NOT_CONFIGURED, { status: 503 })

  const receipt = await getReceipt(params.id)
  if (!receipt) return new NextResponse('Not found', { status: 404 })

  const result = await get(receipt.storageKey, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) {
    return new NextResponse('File not found in storage', { status: 404 })
  }

  const inline = isViewableInBrowser(receipt.mimeType) && request.nextUrl.searchParams.get('download') !== '1'
  const asciiName = receipt.originalFilename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return new NextResponse(result.stream, {
    headers: {
      // Type comes from what we verified at upload time, not from anything the client said
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(receipt.originalFilename)}`,
      'Content-Length': String(receipt.sizeBytes),
      'X-Content-Type-Options': 'nosniff',
      // Financial documents: never store in shared or on-disk caches
      'Cache-Control': 'private, no-store',
    },
  })
}
