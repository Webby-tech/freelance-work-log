'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import type { Client } from '@/lib/db/schema'
import type { WorkEntryWithClient } from '@/lib/db/queries/entries'
import { deleteEntryAction } from '@/actions/entry.actions'
import { formatCurrency, formatDateRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, MapPin } from 'lucide-react'

interface Props {
  entries: WorkEntryWithClient[]
  clients: Client[]
  taxYears: string[]
  selectedYear: string
}

export function EntryTable({ entries, clients, taxYears, selectedYear }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [deleting, setDeleting] = useState<string | null>(null)

  function updateFilter(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (value) { p.set(key, value) } else { p.delete(key) }
    router.push(`${pathname}?${p.toString()}`)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete entry at ${name}?`)) return
    setDeleting(id)
    try {
      await deleteEntryAction(id)
      toast.success('Entry deleted')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  // Month options: current tax year months
  const months = Array.from(new Set(entries.map(e => e.date.slice(0, 7)))).sort().reverse()

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedYear}
          onChange={e => {
            const p = new URLSearchParams(searchParams.toString())
            p.set('year', e.target.value)
            p.delete('month') // reset month when year changes
            router.push(`${pathname}?${p.toString()}`)
          }}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {taxYears.map(y => (
            <option key={y} value={y}>{y.replace('/', '–20')}</option>
          ))}
        </select>

        <select
          value={searchParams.get('client') ?? ''}
          onChange={e => updateFilter('client', e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={searchParams.get('month') ?? ''}
          onChange={e => updateFilter('month', e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          value={searchParams.get('invoiced') ?? ''}
          onChange={e => updateFilter('invoiced', e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All entries</option>
          <option value="false">Uninvoiced only</option>
          <option value="true">Invoiced only</option>
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">No entries found.</p>
          <Button asChild className="mt-3" size="sm" variant="outline">
            <Link href="/log/new">Add first entry</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => {
            const fee       = Number(e.flatFee)
            const miles     = e.returnMiles ?? 0
            const mileRate  = Number(e.mileageRate ?? 0.45)
            const mileValue = miles * mileRate
            const travel    = Number(e.travelExpenses ?? 0)

            return (
              <div
                key={e.id}
                className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{e.locationName}</span>
                      <Badge variant="outline" className="text-xs">{e.client.name}</Badge>
                      {e.invoiceId
                        ? <Badge className="text-xs bg-green-100 text-green-800 border-green-200">Invoiced</Badge>
                        : <Badge variant="secondary" className="text-xs">Uninvoiced</Badge>
                      }
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDateRange(e.date, e.endDate)}
                    </p>
                    {e.details && <p className="text-xs text-slate-400 mt-0.5">{e.details}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                      {fee > 0 && <span>Fee {formatCurrency(fee)}</span>}
                      {miles > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />{miles} mi · {formatCurrency(mileValue)}
                        </span>
                      )}
                      {travel > 0 && (
                        <span>Travel {formatCurrency(travel)}{e.travelExpensesDescription ? ` · ${e.travelExpensesDescription}` : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7" title={e.invoiceId ? 'Edit (invoiced — fee changes won\'t alter the invoice)' : 'Edit'}>
                      <Link href={`/log/${e.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                    </Button>
                    {!e.invoiceId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                        disabled={deleting === e.id}
                        onClick={() => handleDelete(e.id, e.locationName)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
