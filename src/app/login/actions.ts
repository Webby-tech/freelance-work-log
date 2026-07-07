'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const password = formData.get('password')
  if (typeof password !== 'string' || password !== process.env.APP_PASSWORD) {
    return { error: 'Incorrect password' }
  }

  const cookieStore = await cookies()
  cookieStore.set('auth', process.env.APP_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect('/')
}
