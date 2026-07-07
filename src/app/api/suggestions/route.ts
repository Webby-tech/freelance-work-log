import { NextRequest, NextResponse } from 'next/server'
import { isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workEntries } from '@/lib/db/schema'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'location') {
    const rows = await db
      .select({
        location_name: workEntries.locationName,
        location_postcode: workEntries.locationPostcode,
        location_lat: workEntries.locationLat,
        location_lng: workEntries.locationLng,
      })
      .from(workEntries)
      .where(isNotNull(workEntries.locationName))
      .orderBy(workEntries.locationName)

    const seen = new Set<string>()
    const unique = rows.filter(r => {
      if (seen.has(r.location_name!)) return false
      seen.add(r.location_name!)
      return true
    })
    return NextResponse.json(unique)
  }

  if (type === 'details') {
    const rows = await db
      .select({ details: workEntries.details })
      .from(workEntries)
      .where(isNotNull(workEntries.details))
      .orderBy(workEntries.details)

    const seen = new Set<string>()
    const unique = rows.filter((r): r is { details: string } => {
      if (r.details === null || seen.has(r.details)) return false
      seen.add(r.details)
      return true
    })
    return NextResponse.json(unique.map(r => r.details))
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
