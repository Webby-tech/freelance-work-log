'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, BookOpen, FileText, Users, BarChart2, Settings } from 'lucide-react'

const nav = [
  { href: '/',         label: 'Dash',     icon: LayoutDashboard },
  { href: '/log',      label: 'Log',      icon: BookOpen },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/clients',  label: 'Clients',  icon: Users },
  { href: '/reports',  label: 'Reports',  icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-700 flex z-50">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1',
              active ? 'text-white' : 'text-slate-400'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
