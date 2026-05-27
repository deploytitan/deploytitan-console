'use client'

/**
 * RootTopBar — slim navigation bar shown on the root "/" route.
 *
 * Replaces the full sidebar when no org is selected. Contains:
 * - DeployTitan brand mark (links to /)
 * - User menu (profile, billing, theme, sign out)
 */

import { useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from '@/lib/navigation'
import { LogOut, Moon, Sun, User, CreditCard } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { UserAvatar } from '../ui/UserAvatar'

function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('dt-theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  try { localStorage.setItem('dt-theme', theme) } catch { /* ignore */ }
}

export function RootTopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuOpen])

  const displayName = user?.firstName
    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
    : user?.email ?? ''

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/login' })
  }

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-line bg-surface">
      {/* Brand mark */}
      <Link
        to="/overview"
        className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-[2px]"
        aria-label="DeployTitan — all organizations"
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center bg-ink"
          style={{ borderRadius: '2px' }}
          aria-hidden="true"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-surface)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="font-sans text-[13px] font-semibold tracking-tight leading-none select-none">
          <span className="text-ink">Deploy</span>
          <span style={{ color: 'var(--color-primary-dark, #a68a3e)' }}>Titan</span>
        </span>
      </Link>

      {/* User menu */}
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="User menu"
          className={[
            'flex items-center gap-2 px-2 py-1.5 rounded-[4px] transition-colors',
            'text-ink-secondary hover:text-ink hover:bg-surface-alt',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
            menuOpen ? 'bg-surface-alt text-ink' : '',
          ].join(' ')}
        >
          {user && (
            <UserAvatar
              profilePictureUrl={user.profilePictureUrl}
              firstName={user.firstName}
              lastName={user.lastName}
              email={user.email}
              size="sm"
            />
          )}
          {displayName && (
            <span className="text-[12px] font-medium truncate max-w-[140px]"
              style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}>
              {displayName}
            </span>
          )}
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className={[
              'absolute top-full right-0 mt-1 w-52 z-50',
              'border border-line bg-surface shadow-md',
              'overflow-hidden py-1',
            ].join(' ')}
            style={{ borderRadius: '4px' }}
          >
            {displayName && (
              <div className="px-3 py-2.5 border-b border-line">
                <p className="text-[12px] font-medium text-ink truncate">{displayName}</p>
                {user?.email && (
                  <p className="text-[10px] text-ink-quaternary truncate mt-0.5"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {user.email}
                  </p>
                )}
              </div>
            )}

            <div className="py-1">
              <TopBarMenuRow
                icon={<User size={13} />}
                label="Profile settings"
                onClick={() => { setMenuOpen(false); navigate({ to: '/settings' }) }}
              />
              <TopBarMenuRow
                icon={<CreditCard size={13} />}
                label="Billing"
                onClick={() => { setMenuOpen(false); navigate({ to: '/billing' }) }}
              />
            </div>

            <div className="border-t border-line py-1">
              <TopBarMenuRow
                icon={theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              />
            </div>

            <div className="border-t border-line py-1">
              <TopBarMenuRow
                icon={<LogOut size={13} />}
                label="Sign out"
                onClick={() => { setMenuOpen(false); void handleLogout() }}
                danger
              />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function TopBarMenuRow({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors text-left',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40',
        danger
          ? 'text-signal-danger/80 hover:text-signal-danger hover:bg-signal-danger/8'
          : 'text-ink-secondary hover:text-ink hover:bg-surface-alt',
      ].join(' ')}
      style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  )
}
