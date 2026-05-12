import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/index'
import { fromDb } from '@/lib/db/mappers'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const clientId  = searchParams.get('clientId')
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('work_entries')
    .select('*')
    .eq('client_id', clientId)
    .is('invoice_id', null)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data as unknown[]).map(row => fromDb(row)))
}
