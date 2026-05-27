'use client'

/**
 * InviteTeamPage — onboarding step 4 of 4.
 * Route: /onboarding/invite-team
 *
 * Allows the user to invite colleagues by email before entering the console.
 * Invites are sent one at a time; multiple pending invites are tracked in
 * local state and submitted as a batch when the user clicks "Send invites".
 *
 * "Skip for now" goes straight to the console (/orgs/:orgId or / if no org
 * context is available yet).
 */

import { useState } from 'react'
import { useNavigate } from '@/lib/navigation'
import { useMutation } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { useOrgList } from '../../hooks/useOrgList'
import { apiRequest } from '../../lib/api'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARKETING_URL = 'https://deploytitan.com'

const STEPS = [
  { label: 'Account', n: 1 },
  { label: 'Profile', n: 2 },
  { label: 'Organisation', n: 3 },
  { label: 'Team', n: 4 },
]

const ROLES = ['Member', 'Admin', 'Viewer'] as const
type Role = (typeof ROLES)[number]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InviteNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-line-subtle bg-surface/90 backdrop-blur-[12px]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
        <a
          href={MARKETING_URL}
          className="flex items-center gap-2.5 group"
          aria-label="Back to DeployTitan.com"
        >
          <div
            className="w-6 h-6 bg-ink flex items-center justify-center transition-opacity group-hover:opacity-80"
            style={{ borderRadius: '2px' }}
          >
            <svg
              width="14"
              height="14"
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
          <span className="font-display font-medium text-sm text-ink">
            <span>Deploy</span>
            <span className="text-primary-dark">Titan</span>
          </span>
        </a>
        <ThemeToggle />
      </div>
    </nav>
  )
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0" role="list" aria-label="Onboarding steps">
      {STEPS.map((step, i) => {
        const done = step.n < current
        const active = step.n === current
        return (
          <div key={step.n} className="flex items-center" role="listitem">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 flex items-center justify-center text-[10px] font-mono transition-colors"
                style={{
                  borderRadius: '2px',
                  border: active
                    ? '1px solid var(--color-primary)'
                    : done
                      ? '1px solid var(--color-primary-dark)'
                      : '1px solid var(--color-line)',
                  background: active
                    ? 'var(--color-primary)'
                    : done
                      ? 'var(--color-primary-dark)'
                      : 'transparent',
                  color: active || done ? 'var(--color-surface)' : 'var(--color-ink-quaternary)',
                }}
                aria-current={active ? 'step' : undefined}
              >
                {done ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                ) : (
                  step.n
                )}
              </div>
              <span
                className="text-[9px] font-mono uppercase tracking-[0.08em] hidden sm:block"
                style={{
                  color: active ? 'var(--color-ink-secondary)' : 'var(--color-ink-quaternary)',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-8 h-px mx-1 mb-4 transition-colors"
                style={{
                  background: done ? 'var(--color-primary-dark)' : 'var(--color-line-subtle)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invite row
// ---------------------------------------------------------------------------

interface InviteEntry {
  id: string
  email: string
  role: Role
}

function InviteRow({
  entry,
  onChange,
  onRemove,
  showRemove,
}: {
  entry: InviteEntry
  onChange: (updated: InviteEntry) => void
  onRemove: () => void
  showRemove: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Email */}
      <input
        type="email"
        placeholder="colleague@company.com"
        value={entry.email}
        onChange={(e) => onChange({ ...entry, email: e.target.value })}
        className="flex-1 bg-surface border border-line text-sm text-ink placeholder:text-ink-quaternary
                   px-3 py-2.5
                   focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
                   transition-colors"
        style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
        aria-label="Email address"
      />

      {/* Role select */}
      <div className="relative">
        <select
          value={entry.role}
          onChange={(e) => onChange({ ...entry, role: e.target.value as Role })}
          className="appearance-none bg-surface border border-line text-sm text-ink
                     pl-3 pr-7 py-2.5
                     focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
                     transition-colors cursor-pointer"
          style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          aria-label="Role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-quaternary"
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <polyline points="2 4 6 8 10 4" />
        </svg>
      </div>

      {/* Remove */}
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-ink-quaternary hover:text-ink-tertiary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-[2px]"
          aria-label="Remove invite"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

let idCounter = 0
const nextId = () => String(++idCounter)

function makeEntry(): InviteEntry {
  return { id: nextId(), email: '', role: 'Member' }
}

export function InviteTeamPage() {
  const navigate = useNavigate()
  const { orgs } = useOrgList()
  const existingOrg = orgs[0] ?? null
  const [invites, setInvites] = useState<InviteEntry[]>([makeEntry()])
  const [sent, setSent] = useState(false)

  const hasValidInvite = invites.some((e) => e.email.trim().includes('@'))

  const inviteMutation = useMutation({
    mutationFn: (entries: InviteEntry[]) =>
      apiRequest('/onboarding/invites', {
        method: 'POST',
        json: {
          invites: entries
            .filter((e) => e.email.trim().includes('@'))
            .map((e) => ({ email: e.email.trim(), role: e.role })),
        },
      }),
    onSuccess: () => {
      setSent(true)
      setTimeout(() => goToConsole(), 1200)
    },
    onError: () => {
      // Optimistic: proceed anyway
      goToConsole()
    },
  })

  const goToConsole = () => {
    if (existingOrg) {
      void navigate({ to: '/orgs/$orgId', params: { orgId: existingOrg.workosOrgId }, replace: true })
    } else {
      void navigate({ to: '/', replace: true })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMutation.mutate(invites)
  }

  const updateEntry = (id: string, updated: InviteEntry) =>
    setInvites((prev) => prev.map((e) => (e.id === id ? updated : e)))

  const removeEntry = (id: string) => setInvites((prev) => prev.filter((e) => e.id !== id))

  const addEntry = () => setInvites((prev) => [...prev, makeEntry()])

  return (
    <div className="min-h-screen flex flex-col bg-surface relative overflow-hidden">
      <InviteNav />

      {/* Blueprint grid */}
      <div className="absolute inset-0 blueprint-grid opacity-30 pointer-events-none" />

      {/* Vertical scan line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        <div className="login-scan-line" />
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-12"
        style={{ zIndex: 2 }}
      >
        {/* Step indicator */}
        <div className="mb-8">
          <StepIndicator current={4} />
        </div>

        {/* Card */}
        <div
          className="relative w-full max-w-md border border-line corner-accent bg-surface-alt animate-fade-up"
          style={{ borderRadius: '2px' }}
        >
          <div className="gold-line" />

          <div className="p-8 sm:p-10 space-y-7">
            {/* Heading */}
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-tertiary">
                Step 4 of 4
              </p>
              <h1
                className="text-xl font-semibold tracking-tight text-ink"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
              >
                Invite your team
              </h1>
              <p
                className="text-sm text-ink-tertiary"
                style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              >
                Add colleagues now or invite them later from settings.
              </p>
            </div>

            <div className="border-t border-line-subtle" />

            {sent ? (
              /* Success state */
              <div className="flex flex-col items-center gap-3 py-4">
                <div
                  className="w-10 h-10 flex items-center justify-center"
                  style={{
                    borderRadius: '2px',
                    background: 'var(--color-primary-dark)',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="var(--color-surface)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                </div>
                <p
                  className="text-sm font-medium text-ink text-center"
                  style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
                >
                  Invites sent. Taking you to the console...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Section label */}
                <div className="flex items-center gap-3 text-sm font-mono text-ink-secondary">
                  <span className="w-8 h-px bg-gold/40" />
                  Email addresses
                </div>

                {/* Invite rows */}
                <div className="space-y-2.5">
                  {invites.map((entry) => (
                    <InviteRow
                      key={entry.id}
                      entry={entry}
                      onChange={(updated) => updateEntry(entry.id, updated)}
                      onRemove={() => removeEntry(entry.id)}
                      showRemove={invites.length > 1}
                    />
                  ))}
                </div>

                {/* Add another */}
                <button
                  type="button"
                  onClick={addEntry}
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-tertiary hover:text-ink-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-[2px]"
                >
                  <Plus size={12} strokeWidth={2} />
                  Add another
                </button>

                {/* CTAs */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={!hasValidInvite || inviteMutation.isPending}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3
                               bg-ink text-surface text-sm font-medium
                               hover:bg-ink/90 active:scale-[0.97]
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
                    style={{ borderRadius: '2px' }}
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <span
                          className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"
                          aria-hidden="true"
                        />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send invites
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="2" y1="6" x2="10" y2="6" />
                          <polyline points="7 3 10 6 7 9" />
                        </svg>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={goToConsole}
                    className="w-full text-center text-[11px] font-mono text-ink-quaternary hover:text-ink-secondary
                               transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-[2px]"
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] font-mono text-ink-quaternary uppercase tracking-[0.08em]">
          Secure via WorkOS
        </p>
      </div>
    </div>
  )
}
