import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { isValidAuthCookie } from '@/lib/auth'
import { MAX_RECEIPT_BYTES, checkUploadRequest } from '@/lib/receipts'
import { STORAGE_NOT_CONFIGURED, storageConfigured } from '@/lib/receipt-storage'
import { parentExists } from '@/lib/db/queries/receipts'

// Issues a short-lived token so the browser can upload a receipt DIRECTLY to private
// storage (the file never passes through this server, so Vercel's request-body limit
// doesn't apply). Everything is validated here, before a token is issued:
// signed in, storage configured, file type and size, and the expense really exists.
//
// No onUploadCompleted callback is used, so Vercel never has to call back into this
// password-protected app; the browser registers the finished upload itself
// (registerReceiptAction), which re-verifies the stored file.
export async function POST(request: NextRequest) {
  if (!isValidAuthCookie(request.cookies.get('auth')?.value)) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: STORAGE_NOT_CONFIGURED }, { status: 503 })
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let raw: unknown
        try {
          raw = JSON.parse(clientPayload ?? '')
        } catch {
          throw new Error('Invalid upload request.')
        }
        const check = checkUploadRequest(raw)
        if (!check.ok) throw new Error(check.error)
        if (pathname !== check.pathname) throw new Error('Invalid upload path.')
        if (!(await parentExists(check.meta.parentType, check.meta.parentId))) {
          throw new Error('That expense no longer exists.')
        }
        return {
          allowedContentTypes: [check.mime],
          maximumSizeInBytes: MAX_RECEIPT_BYTES,
          addRandomSuffix: true,                       // unguessable key; never overwrites
          validUntil: Date.now() + 10 * 60 * 1000,     // token good for 10 minutes
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
