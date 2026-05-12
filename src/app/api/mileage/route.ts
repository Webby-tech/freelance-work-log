import { NextRequest, NextResponse } from 'next/server'
import { ceilToNearest5 } from '@/lib/mileage'

const METERS_PER_MILE = 1609.344

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const olat = parseFloat(searchParams.get('olat') ?? '')
  const olng = parseFloat(searchParams.get('olng') ?? '')
  const dlat = parseFloat(searchParams.get('dlat') ?? '')
  const dlng = parseFloat(searchParams.get('dlng') ?? '')

  if ([olat, olng, dlat, dlng].some(isNaN)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const osrmUrl =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${olng},${olat};${dlng},${dlat}?overview=false`

  console.log('[/api/mileage] OSRM request:', osrmUrl)

  let res: Response
  try {
    res = await fetch(osrmUrl)
  } catch (err) {
    console.error('[/api/mileage] OSRM fetch threw:', err)
    return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })
  }

  console.log('[/api/mileage] OSRM status:', res.status)

  if (!res.ok) {
    return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })
  }

  const json = await res.json()
  console.log('[/api/mileage] OSRM code:', json.code, 'routes:', json.routes?.length ?? 0)

  if (!json.routes?.length) {
    return NextResponse.json({ error: 'No route found' }, { status: 404 })
  }

  const rawOneWayMiles  = json.routes[0].distance / METERS_PER_MILE
  const rawReturnMiles  = rawOneWayMiles * 2

  console.log('[/api/mileage] one-way miles:', rawOneWayMiles.toFixed(2), '→ return rounded:', ceilToNearest5(rawReturnMiles))

  return NextResponse.json({
    rawOneWay:     rawOneWayMiles,
    returnRounded: ceilToNearest5(rawReturnMiles),
  })
}
