'use client'
import { useState, useCallback, useRef } from 'react'

export interface PostcodeResult {
  postcode: string
  lat: number
  lng: number
}

export function usePostcodeLookup() {
  const [result, setResult]   = useState<PostcodeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookup = useCallback((postcode: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const clean = postcode.trim().toUpperCase().replace(/\s+/g, '')
    if (clean.length < 5) {
      setResult(null)
      setError(null)
      return
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        // Route through our server-side proxy — avoids browser CORS/CSP issues
        const res = await fetch(`/api/postcode?pc=${encodeURIComponent(clean)}`)
        console.log('[usePostcodeLookup] status:', res.status, 'for', clean)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.warn('[usePostcodeLookup] error body:', body)
          setError('Postcode not found')
          setResult(null)
          return
        }
        const r = await res.json()
        console.log('[usePostcodeLookup] result:', r)
        setResult({ postcode: r.postcode, lat: r.lat, lng: r.lng })
      } catch (err) {
        console.error('[usePostcodeLookup] fetch threw:', err)
        setError('Lookup failed')
        setResult(null)
      } finally {
        setLoading(false)
      }
    }, 500)
  }, [])

  return { result, loading, error, lookup }
}
