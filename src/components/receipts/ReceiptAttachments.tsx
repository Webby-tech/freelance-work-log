'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { upload } from '@vercel/blob/client'
import { Camera, Download, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatFileSize, isImageMime, isViewableInBrowser, receiptPathname, validateReceiptFile,
  type UploadRequestMeta,
} from '@/lib/receipts'
import { checkReceiptUploadAction, deleteReceiptAction, registerReceiptAction } from '@/actions/receipt.actions'
import type { ReceiptParentType } from '@/lib/db/schema'
import type { ReceiptView } from '@/lib/db/queries/receipts'

interface Props {
  parentType: ReceiptParentType
  parentId: string
  receipts: ReceiptView[]
  // false for expenses on an invoiced entry: receipts can be added but not removed
  canDelete?: boolean
}

export function ReceiptAttachments({ parentType, parentId, receipts, canDelete = true }: Props) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const busy = progress !== null

  async function uploadOne(file: File): Promise<boolean> {
    const check = validateReceiptFile(file)
    if (!check.ok) {
      toast.error(check.error)
      return false
    }
    const meta: UploadRequestMeta = {
      parentType, parentId, filename: file.name, contentType: check.mime, size: file.size,
    }
    try {
      // Straight from the browser to private storage, using a short-lived token the
      // server issues (after checking type, size and that you're signed in).
      const blob = await upload(receiptPathname(parentType, parentId, check.safeName), file, {
        access: 'private',
        handleUploadUrl: '/api/receipts/upload',
        clientPayload: JSON.stringify(meta),
        contentType: check.mime,
        onUploadProgress: p => setProgress(Math.round(p.percentage)),
      })
      const res = await registerReceiptAction({
        parentType, parentId, pathname: blob.pathname, originalFilename: file.name,
      })
      if (!res.ok) {
        toast.error(res.error)
        return false
      }
      toast.success(`Attached ${check.safeName}`)
      return true
    } catch (err) {
      // The upload SDK only reports a generic failure; ask the server for the real reason.
      const why = await checkReceiptUploadAction(meta).catch(() => null)
      toast.error(why && !why.ok ? why.error : err instanceof Error ? err.message : 'Upload failed')
      return false
    }
  }

  async function handleFiles(list: FileList | null, input: HTMLInputElement | null) {
    const files = list ? Array.from(list) : []
    if (input) input.value = ''            // lets the same file be chosen again
    if (files.length === 0) return
    setProgress(0)
    let attached = 0
    for (const f of files) if (await uploadOne(f)) attached++
    setProgress(null)
    if (attached > 0) router.refresh()
  }

  async function handleRemove(r: ReceiptView) {
    if (!confirm(`Remove receipt "${r.originalFilename}"?\n\nThe file will be permanently deleted from storage.`)) return
    setRemoving(r.id)
    const res = await deleteReceiptAction(r.id)
    setRemoving(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Receipt removed')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {receipts.length > 0 && (
        <ul className="space-y-1.5">
          {receipts.map(r => {
            const href = `/api/receipts/${r.id}`
            const viewable = isViewableInBrowser(r.mimeType)
            return (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <a
                  href={viewable ? href : `${href}?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50 text-slate-400"
                  aria-label={`${viewable ? 'View' : 'Download'} ${r.originalFilename}`}
                >
                  {isImageMime(r.mimeType)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={href} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <FileText className="h-5 w-5" />}
                </a>
                <a
                  href={viewable ? href : `${href}?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-blue-700 hover:underline"
                >
                  {r.originalFilename}
                  <span className="ml-1 text-slate-400">· {formatFileSize(r.sizeBytes)}{viewable ? '' : ' · download'}</span>
                  {!viewable && <Download className="ml-1 inline h-3 w-3" />}
                </a>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleRemove(r)}
                    disabled={removing === r.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-red-400 hover:text-red-600 disabled:opacity-40"
                    aria-label={`Remove ${r.originalFilename}`}
                  >
                    {removing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Main flow: standard file picker, so PDFs saved by Adobe Scan (Files / Downloads) are easy to pick */}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files, e.target)}
        />
        {/* Secondary flow: straight from the camera */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => handleFiles(e.target.files, e.target)}
        />
        <Button type="button" variant="outline" size="sm" className="h-9 text-xs" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-1 h-3.5 w-3.5" />}
          {busy ? `Uploading… ${progress}%` : 'Attach receipt'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" disabled={busy} onClick={() => cameraInput.current?.click()}>
          <Camera className="mr-1 h-3.5 w-3.5" />Take photo
        </Button>
      </div>

      {!canDelete && (
        <p className="text-xs text-slate-400">Invoiced entry: you can add receipts, but existing ones can&apos;t be removed.</p>
      )}
    </div>
  )
}
