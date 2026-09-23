import { Paperclip } from 'lucide-react'

// Small per-row indicator: receipt attached (with count) or missing.
export function ReceiptBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700"
      title={`${count} receipt${count === 1 ? '' : 's'} attached`}
    >
      <Paperclip className="h-3 w-3" />{count}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
      title="No receipt attached"
    >
      <Paperclip className="h-3 w-3" />No receipt
    </span>
  )
}
