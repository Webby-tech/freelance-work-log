import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const pc = req.nextUrl.searchParams.get('pc')
  if (!pc) return NextResponse.json({ error: 'Missing postcode' }, { status: 400 })

  const clean = pc.trim().toUpperCase().replace(/\s+/g, '')
  console.log('[/api/postcode] looking up:', clean)

  let res: Response
  try {
    res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`)
  } catch (err) {
    console.error('[/api/postcode] fetch to postcodes.io threw:', err)
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
  }

  console.log('[/api/postcode] postcodes.io status:', res.status)

  if (!res.ok) {
    return NextResponse.json({ error: 'Postcode not found' }, { status: 404 })
  }

  const json = await res.json()
  const result = json.result
  console.log('[/api/postcode] result:', result.postcode, result.latitude, result.longitude)

  return NextResponse.json({
    postcode: result.postcode,
    lat: result.latitude,
    lng: result.longitude,
  })
}
