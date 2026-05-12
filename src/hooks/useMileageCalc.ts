'use client'
import { useState, useEffect } from 'react'
import type { PostcodeResult } from './usePostcodeLookup'

export interface MileageResult {
  rawOneWay: number
  returnRounded: number
}

export function useMileageCalc(
  origin: PostcodeResult | null,
  destination: PostcodeResult | null
) {
  const [mileage, setMileage]   = useState<MileageResult | null>(null)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (!origin || !destination) {
      setMileage(null)
      return
    }
    setLoading(true)
    const url = `/api/mileage?olat=${origin.lat}&olng=${origin.lng}&dlat=${destination.lat}&dlng=${destination.lng}`
    fetch(url)
      .then(r => r.json())
      .then(data => setMileage(data))
      .catch(() => setMileage(null))
      .finally(() => setLoading(false))
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng])

  return { mileage, loading }
}
