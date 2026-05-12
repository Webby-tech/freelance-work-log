import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount)
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM yyyy')
}

export function formatDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start)
  const s = parseISO(start)
  const e = parseISO(end)
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  return `${format(s, 'd')}–${format(e, 'd MMM yyyy')} (${days} days)`
}

export function formatPostcode(pc: string): string {
  const clean = pc.trim().toUpperCase().replace(/\s+/g, '')
  if (clean.length >= 5) {
    return clean.slice(0, -3) + ' ' + clean.slice(-3)
  }
  return clean
}

export function formatSortCode(raw: string): string {
  return raw.replace(/\D/g, '').replace(/(.{2})(.{2})(.{2})/, '$1-$2-$3')
}
