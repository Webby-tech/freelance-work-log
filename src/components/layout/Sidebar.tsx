'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  BarChart2,
  Settings,
} from 'lucide-react'

const nav = [
  { href: '/',          label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/log',       label: 'Work Log',   icon: BookOpen },
  { href: '/invoices',  label: 'Invoices',   icon: FileText },
  { href: '/clients',   label: 'Clients',    icon: Users },
  { href: '/reports',   label: 'Reports',    icon: BarChart2 },
  { href: '/settings',  label: 'Settings',   icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-slate-900 text-slate-100 shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="font-semibold text-sm tracking-wide text-slate-300">ACTOR WORKLOG</span>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
