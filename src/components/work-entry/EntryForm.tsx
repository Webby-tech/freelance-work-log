'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Client, WorkEntry, UserSettings } from '@/lib/db/schema'
import { createEntryAction, updateEntryAction, type TravelItem } from '@/actions/entry.actions'
import { MileageField } from './MileageField'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Search, Loader2, Plus, Trash2 } from 'lucide-react'

interface Props {
  clients: Client[]
  settings: UserSettings
  existing?: WorkEntry
  existingTravelItems?: TravelItem[]
}

interface MileageData {
  locationPostcode: string
  locationLat: number | null
  locationLng: number | null
  useHomeAsOrigin: boolean
  overrideOriginPc: string | null
  overrideOriginLat: number | null
  overrideOriginLng: number | null
  calculatedMilesRaw: number | null
  returnMiles: number | null
}

interface LocationSuggestion {
  location_name: string
  location_postcode: string | null
  location_lat: string | null
  location_lng: string | null
}

interface SearchResult {
  displayName: string
  lat: number
  lng: number
  postcode: string | null
}

export function EntryForm({ clients, settings, existing, existingTravelItems }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [clientId,       setClientId]       = useState(existing?.clientId ?? '')
  const [date,           setDate]           = useState(existing?.date ?? new Date().toISOString().split('T')[0])
  const [endDate,        setEndDate]        = useState(existing?.endDate ?? '')
  const [locationName,   setLocationName]   = useState(existing?.locationName ?? '')
  const [flatFee,          setFlatFee]          = useState(existing?.flatFee ? String(existing.flatFee) : '')
  const [commissionExempt, setCommissionExempt] = useState(existing?.commissionExemptAmount ? String(existing.commissionExemptAmount) : '')
  const [travelItems, setTravelItems] = useState<TravelItem[]>(
    existingTravelItems && existingTravelItems.length > 0
      ? existingTravelItems
      : []
  )
  const [details,        setDetails]        = useState(existing?.details ?? '')
  const [notes,          setNotes]          = useState(existing?.notes ?? '')
  const [mileageData,    setMileageData]    = useState<MileageData>({
    locationPostcode:   existing?.locationPostcode ?? '',
    locationLat:        existing?.locationLat ? Number(existing.locationLat) : null,
    locationLng:        existing?.locationLng ? Number(existing.locationLng) : null,
    useHomeAsOrigin:    existing?.useHomeAsOrigin ?? true,
    overrideOriginPc:   existing?.overrideOriginPc ?? null,
    overrideOriginLat:  existing?.overrideOriginLat ? Number(existing.overrideOriginLat) : null,
    overrideOriginLng:  existing?.overrideOriginLng ? Number(existing.overrideOriginLng) : null,
    calculatedMilesRaw: existing?.calculatedMilesRaw ? Number(existing.calculatedMilesRaw) : null,
    returnMiles:        existing?.returnMiles ?? null,
  })

  // Autocomplete data
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [detailsSuggestions,  setDetailsSuggestions]  = useState<string[]>([])

  // Location name search results
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [showResults,    setShowResults]    = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Postcode to push into MileageField
  const [destPcOverride, setDestPcOverride] = useState('')

  const homeLat = settings.homeLat ? Number(settings.homeLat) : 51.5074
  const homeLng = settings.homeLng ? Number(settings.homeLng) : -0.1278

  // Inclusive day count: 28 Apr → 30 Apr = 3 days
  const numDays = (() => {
    if (!endDate) return 1
    const diff = Math.round(
      (new Date(endDate).getTime() - new Date(date).getTime()) / 86_400_000
    )
    return Math.max(1, diff + 1)
  })()

  useEffect(() => {
    fetch('/api/suggestions?type=location').then(r => r.json()).then(setLocationSuggestions).catch(() => {})
    fetch('/api/suggestions?type=details').then(r => r.json()).then(setDetailsSuggestions).catch(() => {})
  }, [])

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // When location name matches a known location exactly, pre-fill postcode
  function handleLocationNameChange(value: string) {
    setLocationName(value)
    const known = locationSuggestions.find(
      s => s.location_name.toLowerCase() === value.toLowerCase()
    )
    if (known?.location_postcode) {
      setDestPcOverride(known.location_postcode)
    }
  }

  async function searchLocation() {
    if (!locationName.trim()) return
    setSearchLoading(true)
    setSearchResults([])
    setShowResults(false)
    try {
      const res = await fetch(`/api/search-location?q=${encodeURIComponent(locationName.trim())}`)
      const data: SearchResult[] = await res.json()
      setSearchResults(data)
      setShowResults(data.length > 0)
    } catch {
      toast.error('Location search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  function applySearchResult(result: SearchResult) {
    if (result.postcode) setDestPcOverride(result.postcode)
    setShowResults(false)
    setSearchResults([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { toast.error('Please select a client'); return }
    setSaving(true)
    try {
      const payload = {
        clientId,
        date,
        endDate: endDate || null,
        locationName,
        locationPostcode:   mileageData.locationPostcode || null,
        locationLat:        mileageData.locationLat ? String(mileageData.locationLat) : null,
        locationLng:        mileageData.locationLng ? String(mileageData.locationLng) : null,
        details:            details || null,
        flatFee:            flatFee || '0',
        useHomeAsOrigin:    mileageData.useHomeAsOrigin,
        overrideOriginName: mileageData.useHomeAsOrigin ? null : mileageData.overrideOriginPc,
        overrideOriginPc:   mileageData.useHomeAsOrigin ? null : mileageData.overrideOriginPc,
        overrideOriginLat:  mileageData.overrideOriginLat ? String(mileageData.overrideOriginLat) : null,
        overrideOriginLng:  mileageData.overrideOriginLng ? String(mileageData.overrideOriginLng) : null,
        calculatedMilesRaw: mileageData.calculatedMilesRaw ? String(mileageData.calculatedMilesRaw) : null,
        returnMiles:        mileageData.returnMiles,
        mileageRate:        String(settings.defaultMileageRate ?? '0.45'),
        travelExpenses:         String(travelItems.reduce((s, i) => s + Number(i.amount || 0), 0)),
        commissionExemptAmount: commissionExempt || '0',
        notes:                  notes || null,
      }
      const validItems = travelItems.filter(i => i.description.trim() && Number(i.amount) > 0)
      if (existing) {
        await updateEntryAction(existing.id, payload, validItems)
        toast.success('Entry updated')
      } else {
        await createEntryAction(payload, validItems)
        toast.success('Entry saved')
      }
      router.push('/log')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {existing?.invoiceId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>This entry is linked to an invoice.</strong> You can update mileage, travel expenses, and notes freely — they are recorded for HMRC purposes only and will not alter the existing invoice amount.
        </div>
      )}
      <Card>
        <CardContent className="space-y-4 pt-5">
          {/* Client */}
          <div>
            <Label className="text-xs">Client *</Label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              required
              className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input className="mt-1" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">End date (multi-day)</Label>
              <Input className="mt-1" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={date} />
            </div>
          </div>

          {/* Location name with search */}
          <div ref={searchRef} className="relative">
            <Label className="text-xs">Location name *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                list="location-suggestions"
                value={locationName}
                onChange={e => handleLocationNameChange(e.target.value)}
                placeholder="e.g. BBC Maida Vale Studios"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={searchLocation}
                disabled={searchLoading || !locationName.trim()}
                title="Find postcode from location name"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Previous locations datalist */}
            <datalist id="location-suggestions">
              {locationSuggestions.map(s => (
                <option key={s.location_name} value={s.location_name} />
              ))}
            </datalist>

            {/* Search results dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                <p className="px-3 pt-2 pb-1 text-xs text-slate-500">Select the correct location:</p>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-t first:border-t-0"
                    onClick={() => applySearchResult(r)}
                  >
                    <span className="font-medium text-slate-800">{r.postcode}</span>
                    <span className="text-slate-500 ml-2 text-xs line-clamp-1">{r.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fee */}
          <div>
            <Label className="text-xs">Fee (£) — total gross including all payroll items</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500">£</span>
              <Input
                type="number" min="0" step="0.01"
                value={flatFee}
                onChange={e => setFlatFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Commission-exempt amount — payroll clients only */}
          {clients.find(c => c.id === clientId)?.type === 'payroll' && (
            <div>
              <Label className="text-xs">Commission-exempt amount (£)</Label>
              <p className="text-xs text-slate-400 mb-1">Allowance, costume fitting, holiday scheme, etc.</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">£</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={commissionExempt}
                  onChange={e => setCommissionExempt(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Job details */}
          <div>
            <Label className="text-xs">Job details</Label>
            <Input
              className="mt-1"
              list="details-suggestions"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="e.g. Radio drama recording"
            />
            <datalist id="details-suggestions">
              {detailsSuggestions.map(d => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        </CardContent>
      </Card>

      {/* Mileage */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">Mileage</p>
          <MileageField
            homePostcode={settings.homePostcode}
            homeLat={homeLat}
            homeLng={homeLng}
            numDays={numDays}
            initialDestPc={existing?.locationPostcode ?? ''}
            destPcOverride={destPcOverride}
            initialOverrideOriginPc={existing?.overrideOriginPc ?? ''}
            initialUseHome={existing?.useHomeAsOrigin ?? true}
            initialReturnMiles={existing?.returnMiles ?? null}
            onMileageChange={setMileageData}
          />
          <Separator />
          <div>
            <Label className="text-xs">Travel expenses</Label>
            <div className="mt-1 space-y-2">
              {travelItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item.description}
                    onChange={e => setTravelItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                    placeholder="e.g. Parking, Train fare, Toll"
                    className="flex-1"
                  />
                  <span className="text-sm text-slate-500 shrink-0">£</span>
                  <Input
                    type="number" min="0" step="0.01"
                    value={item.amount}
                    onChange={e => setTravelItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))}
                    placeholder="0.00"
                    className="w-24 shrink-0"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0"
                    onClick={() => setTravelItems(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button" variant="outline" size="sm"
                className="w-full text-xs"
                onClick={() => setTravelItems(prev => [...prev, { description: '', amount: '' }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />Add travel expense
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-5">
          <Label className="text-xs">Notes</Label>
          <Textarea
            className="mt-1"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes for this entry…"
            rows={2}
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : existing ? 'Save changes' : 'Save entry'}
      </Button>
    </form>
  )
}
