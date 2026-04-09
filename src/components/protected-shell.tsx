'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Briefcase,
  CheckSquare,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from 'lucide-react'
import { SignOutButton } from '@/components/sign-out-button'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/supabase/get-user'

interface TaskBadge {
  overdue: number
  total: number
}

interface ProtectedShellProps {
  fullName: string
  email: string
  role: Role
  taskBadge?: TaskBadge
  children: ReactNode
}

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

function getNavItems(role: Role): NavItem[] {
  if (role === 'client') {
    return [{ href: '/my-progress', label: 'My Progress', icon: CheckSquare }]
  }
  return [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
    { href: '/clients', label: 'Clients', icon: Briefcase },
    { href: '/team', label: 'Team', icon: Users },
  ]
}

function initialsOf(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function ProtectedShell({
  fullName,
  email,
  role,
  taskBadge,
  children,
}: ProtectedShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = getNavItems(role)
  const displayName = fullName || email
  const initials = initialsOf(displayName)

  return (
    <div className="bg-kst-black">
      {/* Top Bar — fixed. Inline styles so nothing in the cascade can
          override z-index / top / position. */}
      <header
        className="flex items-center justify-between px-4 md:px-6 bg-kst-dark border-b border-white/[0.06]"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 -ml-2 text-kst-white"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link
            href="/"
            className="text-3xl text-kst-gold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            KST
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-kst-muted text-sm truncate max-w-[160px]">
            {displayName}
          </span>
          <div className="w-9 h-9 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-xs font-semibold bg-white/[0.02] shrink-0">
            {initials}
          </div>
        </div>
      </header>

      {/* Sidebar (desktop) — fixed below the top bar, full-height scroll */}
      <aside
        className="hidden md:flex flex-col bg-[#111111] border-r border-white/[0.06]"
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          bottom: 0,
          width: 260,
          zIndex: 40,
          overflowY: 'auto',
        }}
      >
        <SidebarContent navItems={navItems} pathname={pathname} taskBadge={taskBadge} />
      </aside>

      {/* Sidebar (mobile overlay) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative w-[260px] bg-[#111111] border-r border-white/[0.06] flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06]">
              <span
                className="text-2xl text-kst-gold"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                KST
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 text-kst-white"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent
              navItems={navItems}
              pathname={pathname}
              taskBadge={taskBadge}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main content — fills the viewport below the top bar and to
          the right of the fixed sidebar. Scrolls internally so the
          bar and sidebar never drift. The left margin only kicks in
          at md+ because the mobile sidebar is an overlay, not inline. */}
      <main
        className="p-4 md:p-8 md:ml-[260px]"
        style={{
          marginTop: 64,
          height: 'calc(100vh - 64px)',
          overflowY: 'auto',
        }}
      >
        <div key={pathname} className="kst-page-enter">
          {children}
        </div>
      </main>
    </div>
  )
}

function SidebarContent({
  navItems,
  pathname,
  taskBadge,
  onNavigate,
}: {
  navItems: NavItem[]
  pathname: string
  taskBadge?: TaskBadge
  onNavigate?: () => void
}) {
  return (
    <div className="flex flex-col flex-1 py-6">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const active =
            item.href !== '#' &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`))
          const Icon = item.icon

          // Badge for My Tasks
          let badge: React.ReactNode = null
          if (item.href === '/my-tasks' && taskBadge) {
            if (taskBadge.overdue > 0) {
              badge = (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {taskBadge.overdue}
                </span>
              )
            } else if (taskBadge.total > 0) {
              badge = (
                <span className="ml-auto bg-white/10 text-kst-muted text-[10px] font-medium min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {taskBadge.total}
                </span>
              )
            }
          }

          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm border-l-2 transition-colors',
                active
                  ? 'border-kst-gold text-kst-gold bg-kst-gold/[0.06]'
                  : 'border-transparent text-kst-muted hover:text-kst-white hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {badge}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-3">
        <SignOutButton variant="link" />
      </div>
    </div>
  )
}
