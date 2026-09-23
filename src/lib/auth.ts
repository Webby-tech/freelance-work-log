import { cookies } from 'next/headers'

// Same check the middleware makes. Receipt routes call this themselves as well, so the
// files stay protected even if a route were ever excluded from the middleware matcher.
export function isValidAuthCookie(value: string | undefined | null): boolean {
  return !!value && !!process.env.APP_PASSWORD && value === process.env.APP_PASSWORD
}

// For server actions / route handlers.
export async function requireAuth(): Promise<void> {
  const store = await cookies()
  if (!isValidAuthCookie(store.get('auth')?.value)) {
    throw new Error('Not signed in.')
  }
}
