import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'location') {
    const { data } = await supabaseAdmin
      .from('work_entries')
      .select('location_name, location_postcode, location_lat, location_lng')
      .not('location_name', 'is', null)
      .order('location_name')

    const seen = new Set<string>()
    const unique = (data ?? []).filter(r => {
      if (seen.has(r.location_name)) return false
      seen.add(r.location_name)
      return true
    })
    return NextResponse.json(unique)
  }

  if (type === 'details') {
    const { data } = await supabaseAdmin
      .from('work_entries')
      .select('details')
      .not('details', 'is', null)
      .order('details')

    const seen = new Set<string>()
    const unique = (data ?? []).filter(r => {
      if (seen.has(r.details)) return false
      seen.add(r.details)
      return true
    })
    return NextResponse.json(unique.map(r => r.details))
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
