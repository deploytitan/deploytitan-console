'use client'

/**
 * Login page — entry point for returning users.
 * Keeps marketing context visible, then redirects to WorkOS AuthKit hosted UI.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@/lib/navigation'
import { useAuth } from '../auth/AuthProvider'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useTheme } from '../hooks/useTheme'

const MARKETING_URL = 'https://deploytitan.com'

function AuthNav() {
  const [scrolled, setScrolled] = useState(false)
  const { resolved } = useTheme()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled
          ? resolved === 'dark'
            ? 'rgba(13,12,10,0.92)'
            : 'rgba(250,250,249,0.92)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--color-line)' : '1px solid transparent',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
        <a href={MARKETING_URL} className="flex items-center gap-2.5 group" aria-label="Back to DeployTitan.com">
          <div className="w-6 h-6 bg-ink flex items-center justify-center transition-opacity group-hover:opacity-80" style={{ borderRadius: '2px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="font-display font-medium text-sm text-ink">
            <span>Deploy</span><span className="text-primary-dark">Titan</span>
          </span>
        </a>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a href={MARKETING_URL} className="hidden sm:inline-flex items-center gap-1.5 text-xs font-sans text-ink-tertiary hover:text-ink transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            deploytitan.com
          </a>
        </div>
      </div>

      {scrolled && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      )}
    </nav>
  )
}

export function Login() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: '/', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const handleSignIn = () => {
    setPending(true)
    login('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface relative overflow-hidden">
      <AuthNav />

      <div className="absolute inset-0 blueprint-grid opacity-30 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        <div className="login-scan-line" />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pt-14" style={{ zIndex: 2 }}>
        <div className="relative w-full max-w-sm border border-line corner-accent bg-surface-alt" style={{ borderRadius: '2px' }}>
          <div className="gold-line" />

          <div className="p-8 sm:p-10 space-y-7">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-ink flex items-center justify-center" style={{ borderRadius: '2px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <span className="font-display font-medium text-2xl tracking-[-0.01em] text-ink">
                <span>Deploy</span><span className="text-primary-dark">Titan</span>
              </span>
            </div>

            {/* Marketing copy */}
            <div className="space-y-3">
              <h1 className="text-base font-semibold text-ink text-center" style={{ letterSpacing: '-0.015em' }}>
                Welcome back
              </h1>
              <ul className="space-y-2">
                {[
                  'Zero-downtime deployments across all your services',
                  'Real-time rollout visibility and instant rollback',
                  'Policy-driven release gates for safer deployments',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-3.5 h-3.5 shrink-0 text-primary-dark">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 8 6 12 14 4" />
                      </svg>
                    </span>
                    <span className="text-xs font-sans text-ink-secondary leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-line-subtle" />

            {/* CTA */}
            <div className="space-y-4">
              <button
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3
                           border border-line text-sm font-medium text-ink bg-surface
                           hover:border-primary/30 hover:bg-surface-alt
                           hover:shadow-[0_0_0_1px_rgba(201,168,76,0.08)]
                           transition-all duration-300 active:scale-[0.97]
                           disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ borderRadius: '2px' }}
                onClick={handleSignIn}
                disabled={pending}
              >
                {pending ? (
                  <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                )}
                {pending ? 'Redirecting...' : 'Sign in'}
              </button>

              {/* Redirect notice */}
              <p className="text-center text-[10px] font-mono text-ink-quaternary leading-relaxed">
                You'll be securely redirected to{' '}
                <span className="text-ink-tertiary">authkit.app</span>
                {' '}to complete sign-in, then brought back here.
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[11px] font-mono text-ink-quaternary">New to DeployTitan?</span>
              <Link to="/signup" className="text-[11px] font-mono text-ink-secondary hover:text-ink underline underline-offset-2 transition-colors">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
