import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { workEntries } from '@/lib/db/schema'
import { getReimbursementByEntry } from '@/lib/db/queries/travel-expenses'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const clientId  = searchParams.get('clientId')
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  try {
    const entries = await db
      .select()
      .from(workEntries)
      .where(
        and(
          eq(workEntries.clientId, clientId),
          isNull(workEntries.invoiceId),
          gte(workEntries.date, startDate),
          lte(workEntries.date, endDate)
        )
      )
      .orderBy(workEntries.date)
    // Entries using reimbursed travel carry `reimbursement`; all others are returned unchanged.
    const reimbursement = await getReimbursementByEntry(entries.map(e => e.id))
    return NextResponse.json(entries.map(e => (reimbursement[e.id] ? { ...e, reimbursement: reimbursement[e.id] } : e)))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
