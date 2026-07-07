import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('auth')?.value
  if (cookie && cookie === process.env.APP_PASSWORD) {
    return NextResponse.next()
  }
  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png).*)'],
}
