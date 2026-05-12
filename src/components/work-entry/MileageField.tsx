'use client'
import { useState, useEffect } from 'react'
import { usePostcodeLookup } from '@/hooks/usePostcodeLookup'
import { useMileageCalc } from '@/hooks/useMileageCalc'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  homePostcode: string
  homeLat: number
  homeLng: number
  numDays?: number
  initialDestPc?: string
  destPcOverride?: string
  initialOverrideOriginPc?: string
  initialUseHome?: boolean
  initialReturnMiles?: number | null
  onMileageChange: (data: {
    locationPostcode: string
    locationLat: number | null
    locationLng: number | null
    useHomeAsOrigin: boolean
    overrideOriginPc: string | null
    overrideOriginLat: number | null
    overrideOriginLng: number | null
    calculatedMilesRaw: number | null
    returnMiles: number | null
  }) => void
}

export function MileageField({
  homePostcode, homeLat, homeLng,
  numDays = 1,
  initialDestPc = '',
  destPcOverride,
  initialOverrideOriginPc = '',
  initialUseHome = true,
  initialReturnMiles = null,
  onMileageChange,
}: Props) {
  const [destPc,      setDestPc]      = useState(initialDestPc)
  const [useHome,     setUseHome]     = useState(initialUseHome)
  const [originPc,    setOriginPc]    = useState(initialOverrideOriginPc)
  const [manualMiles, setManualMiles] = useState(initialReturnMiles != null ? String(initialReturnMiles) : '')
  const [useManual,   setUseManual]   = useState(false)

  // Allow parent to push a postcode in (e.g. from location name search)
  useEffect(() => {
    if (destPcOverride) setDestPc(destPcOverride)
  }, [destPcOverride])

  const dest   = usePostcodeLookup()
  const origin = usePostcodeLookup()

  useEffect(() => { dest.lookup(destPc) }, [destPc, dest.lookup])
  useEffect(() => {
    if (!useHome) origin.lookup(originPc)
  }, [originPc, useHome, origin.lookup])

  const effectiveOrigin = useHome
    ? { postcode: homePostcode, lat: homeLat, lng: homeLng }
    : origin.result

  const { mileage, loading: milesLoading } = useMileageCalc(
    effectiveOrigin && !useManual ? { postcode: effectiveOrigin.postcode, lat: effectiveOrigin.lat, lng: effectiveOrigin.lng } : null,
    dest.result && !useManual ? dest.result : null
  )

  // Propagate changes to parent
  useEffect(() => {
    if (useManual) {
      // Manual entry: save exactly what the user typed — no days multiplier
      const m = parseInt(manualMiles) || null
      onMileageChange({
        locationPostcode:   destPc,
        locationLat:        dest.result?.lat ?? null,
        locationLng:        dest.result?.lng ?? null,
        useHomeAsOrigin:    useHome,
        overrideOriginPc:   useHome ? null : originPc,
        overrideOriginLat:  useHome ? null : (origin.result?.lat ?? null),
        overrideOriginLng:  useHome ? null : (origin.result?.lng ?? null),
        calculatedMilesRaw: null,
        returnMiles:        m,
      })
    } else if (mileage) {
      onMileageChange({
        locationPostcode:   destPc,
        locationLat:        dest.result?.lat ?? null,
        locationLng:        dest.result?.lng ?? null,
        useHomeAsOrigin:    useHome,
        overrideOriginPc:   useHome ? null : originPc,
        overrideOriginLat:  useHome ? null : (origin.result?.lat ?? null),
        overrideOriginLng:  useHome ? null : (origin.result?.lng ?? null),
        calculatedMilesRaw: mileage.rawOneWay,
        returnMiles:        mileage.returnRounded * numDays,
      })
    }
  }, [mileage, manualMiles, useManual, destPc, dest.result, useHome, originPc, origin.result, numDays])

  return (
    <div className="space-y-3">
      {/* Destination postcode */}
      <div>
        <Label className="text-xs">Location postcode</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={destPc}
            onChange={e => setDestPc(e.target.value.toUpperCase())}
            placeholder="e.g. W1A 1AA"
            className="uppercase"
          />
          {dest.loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {dest.result && <MapPin className="h-4 w-4 text-green-500" />}
        </div>
        {dest.error && <p className="text-xs text-red-500 mt-1">{dest.error}</p>}
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          If using the search button, verify the postcode is correct before saving.
        </p>
      </div>

      {/* Origin override */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">
          Origin: {useHome ? <span className="font-medium">{homePostcode}</span> : 'custom'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Override origin</span>
          <Switch checked={!useHome} onCheckedChange={v => setUseHome(!v)} />
        </div>
      </div>

      {!useHome && (
        <div>
          <Label className="text-xs">Custom origin postcode</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={originPc}
              onChange={e => setOriginPc(e.target.value.toUpperCase())}
              placeholder="e.g. NG1 1AA"
              className="uppercase"
            />
            {origin.loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            {origin.result && <MapPin className="h-4 w-4 text-green-500" />}
          </div>
          {origin.error && <p className="text-xs text-red-500 mt-1">{origin.error}</p>}
        </div>
      )}

      {/* Total return mileage result */}
      {!useManual && (mileage !== null || milesLoading) && (
        <div className="flex items-center gap-3 rounded-md bg-slate-50 border px-3 py-2">
          {milesLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : mileage ? (
            <>
              <Badge variant="secondary">{mileage.returnRounded * numDays} miles</Badge>
              <span className="text-xs text-slate-500">
                {numDays > 1
                  ? `${mileage.returnRounded * numDays} mi total (${mileage.returnRounded} mi return × ${numDays} days)`
                  : `Total return mileage — ${(mileage.rawOneWay * 2).toFixed(1)} mi road distance, rounded up to nearest 5`}
              </span>
            </>
          ) : null}
        </div>
      )}

      {/* Manual override */}
      <div className="flex items-center gap-2">
        <Switch checked={useManual} onCheckedChange={setUseManual} />
        <span className="text-xs text-slate-500">Enter miles manually</span>
      </div>

      {useManual && (
        <div>
          <Label className="text-xs">Total return miles (manual)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number" min="0" step="5"
              value={manualMiles}
              onChange={e => setManualMiles(e.target.value)}
              className="w-28"
            />
            <span className="text-xs text-slate-500">miles</span>
          </div>
        </div>
      )}
    </div>
  )
}
