import { NextRequest, NextResponse } from 'next/server'

const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2}$/i

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 3) return NextResponse.json([])

  const query = q.trim()

  // Fast path: input looks like a full UK postcode — skip Nominatim entirely
  if (UK_POSTCODE_RE.test(query)) {
    const clean = query.toUpperCase().replace(/\s+/g, ' ').trim()
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(clean.replace(' ', ''))}`
    )
    if (!res.ok) return NextResponse.json([])
    const json = await res.json()
    const r = json.result
    console.log('FINAL_POSTCODE (direct lookup):', r.postcode)
    return NextResponse.json([{
      displayName: `${r.postcode} — ${r.admin_district ?? ''}, ${r.admin_ward ?? ''}`.replace(/ —\s*,\s*$/, '').trim(),
      postcode: r.postcode,
      lat: r.latitude,
      lng: r.longitude,
    }])
  }

  // Slow path: search by location name via Nominatim
  const nominatimUrl =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&countrycodes=gb&limit=5&addressdetails=1`

  const nominatimRes = await fetch(nominatimUrl, {
    headers: { 'User-Agent': 'ActorWorklog/1.0 (personal-app)' },
  })
  if (!nominatimRes.ok) return NextResponse.json([])

  const data: Array<{
    lat: string
    lon: string
    display_name: string
    address: Record<string, string>
  }> = await nominatimRes.json()

  console.log('NOMINATIM_RESULT:', JSON.stringify(data.slice(0, 3), null, 2))

  const enriched = await Promise.all(
    data.slice(0, 5).map(async r => {
      try {
        // Priority 1: postcode field inside Nominatim's address object
        let postcode: string | null = r.address?.postcode?.trim().toUpperCase() ?? null

        // Priority 2: reverse-geocode only if Nominatim didn't supply one
        if (!postcode) {
          const reverseRes = await fetch(
            `https://api.postcodes.io/postcodes?lon=${r.lon}&lat=${r.lat}&limit=1`
          )
          if (reverseRes.ok) {
            const reverseData = await reverseRes.json()
            postcode = reverseData.result?.[0]?.postcode ?? null
          }
        }

        if (!postcode) return null

        console.log('FINAL_POSTCODE:', postcode, '— for:', r.display_name)

        // Forward-geocode the postcode to get postcodes.io's exact coordinates
        const forwardRes = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(' ', ''))}`
        )
        if (!forwardRes.ok) return null
        const forwardData = await forwardRes.json()
        const { latitude: lat, longitude: lng } = forwardData.result

        return { displayName: r.display_name, postcode, lat, lng }
      } catch {
        return null
      }
    })
  )

  return NextResponse.json(enriched.filter(Boolean))
}
