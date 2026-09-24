import { PDFDocument, StandardFonts, PageSizes, type PDFFont } from 'pdf-lib'

// Appends receipt files onto the end of an already-generated invoice PDF — used for clients
// who reimburse travel at cost, so the evidence for what's being reimbursed travels with the
// invoice in one file instead of a separate email attachment.
//
// PDF receipts (the common case — scanned via Adobe Scan) are embedded as their own page(s).
// JPEG/PNG receipts get a single page-sized image. Anything pdf-lib can't embed (WebP,
// HEIC/HEIF) — or a receipt that failed to download — gets a plain text page instead, so
// nothing is ever silently missing from the file; runs entirely in the browser (pdf-lib works
// client-side), no server round trip beyond fetching each receipt's own bytes.

export interface ReceiptToAppend {
  filename: string
  mimeType: string
  bytes: ArrayBuffer | null   // null when the file couldn't be fetched
  error?: string              // shown on the note page when bytes is null
}

export async function appendReceiptsToPdf(baseBytes: ArrayBuffer, receipts: ReceiptToAppend[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(baseBytes)
  let font: PDFFont | null = null
  const [pageW, pageH] = PageSizes.A4
  const margin = 40

  for (const r of receipts) {
    if (r.bytes && r.mimeType === 'application/pdf') {
      const src = await PDFDocument.load(r.bytes)
      const pages = await doc.copyPages(src, src.getPageIndices())
      pages.forEach(p => doc.addPage(p))
      continue
    }
    if (r.bytes && (r.mimeType === 'image/jpeg' || r.mimeType === 'image/png')) {
      const image = r.mimeType === 'image/jpeg' ? await doc.embedJpg(r.bytes) : await doc.embedPng(r.bytes)
      const page = doc.addPage([pageW, pageH])
      const maxW = pageW - margin * 2
      const maxH = pageH - margin * 2
      const scale = Math.min(maxW / image.width, maxH / image.height, 1)
      const w = image.width * scale
      const h = image.height * scale
      page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h })
      continue
    }

    // Fetch failure, or a format pdf-lib can't embed (e.g. WebP, HEIC/HEIF)
    font ??= await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage([pageW, pageH])
    const reason = r.error ?? `This file type (${r.mimeType}) can't be embedded in the PDF automatically.`
    page.drawText('Receipt not shown on this page', { x: margin, y: pageH - margin - 20, size: 14, font })
    page.drawText(r.filename, { x: margin, y: pageH - margin - 44, size: 11, font, maxWidth: pageW - margin * 2 })
    page.drawText(reason, { x: margin, y: pageH - margin - 68, size: 10, font, maxWidth: pageW - margin * 2, lineHeight: 14 })
    page.drawText('Open it from the Receipts page in the app instead.', { x: margin, y: pageH - margin - 100, size: 10, font })
  }

  return doc.save()
}
