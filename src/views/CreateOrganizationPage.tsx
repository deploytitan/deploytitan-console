'use client'

/**
 * CreateOrganizationPage — standalone full-screen onboarding page.
 * Route: /onboarding/create-org
 *
 * Shown when a user is authenticated but has no workspace yet and
 * arrives at this route directly. No sidebar. Centered layout. Blueprint
 * grid texture in background matches the design system's structural motif.
 *
 * Cancel: shown only when the user already has an org (i.e. adding a second).
 * First-run users have nowhere valid to cancel to, so the link is omitted.
 */

import { useNavigate } from '@/lib/navigation'
import { ArrowLeft } from 'lucide-react'
import { CreateOrganizationForm } from '../components/console/CreateOrganizationForm'
import { useOrgList } from '../hooks/useOrgList'

// ---------------------------------------------------------------------------
// Step indicator (shared visual language with SignUpProfile)
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Account', n: 1 },
  { label: 'Profile', n: 2 },
  { label: 'Workspace', n: 3 },
  { label: 'Team', n: 4 },
]

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
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
                  background: done
                    ? 'var(--color-primary-dark)'
                    : 'var(--color-line-subtle)',
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
// Page
// ---------------------------------------------------------------------------

export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const { orgs } = useOrgList()
  const existingOrg = orgs[0] ?? null
  const hasExistingOrg = existingOrg !== null

  return (
    <div
      className="relative min-h-screen bg-surface flex items-center justify-center px-6"
      aria-label="Create workspace"
    >
      {/* Blueprint grid texture — structural motif, not decoration */}
      <BlueprintGrid />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between h-14 px-8 border-b border-line-subtle">
        <span
          className="text-sm font-semibold tracking-tight text-gold"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          DeployTitan
        </span>

        {/* Cancel — only when user already has an org */}
        {hasExistingOrg && (
          <button
            onClick={() => navigate({ to: '/orgs/$orgId', params: { orgId: existingOrg.workosOrgId } })}
            className="flex items-center gap-1.5 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-[2px] px-2 py-1"
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          >
            <ArrowLeft size={13} strokeWidth={2} />
            Cancel
          </button>
        )}
      </div>

      {/* Form column */}
      <div className="relative z-10 w-full max-w-[420px] py-20">
        {/* Step indicator — only for first-time onboarding flow */}
        {!hasExistingOrg && (
          <div className="flex justify-center mb-8">
            <StepIndicator current={3} />
          </div>
        )}

        <CreateOrganizationForm
          onSuccess={(org) =>
            navigate({ to: '/orgs/$orgId', params: { orgId: org.workosOrgId }, replace: true })
          }
        />
      </div>
    </div>
  )
}

/**
 * Renders a very-low-opacity blueprint grid as a CSS background.
 * 120px major grid / 24px minor grid — matches the design system spec.
 * Pure CSS, no images, respects reduced motion (static, no animation here).
 */
function BlueprintGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{
        backgroundImage: `
          linear-gradient(oklch(0.55 0.09 85 / 0.045) 1px, transparent 1px),
          linear-gradient(90deg, oklch(0.55 0.09 85 / 0.045) 1px, transparent 1px),
          linear-gradient(oklch(0.55 0.09 85 / 0.018) 1px, transparent 1px),
          linear-gradient(90deg, oklch(0.55 0.09 85 / 0.018) 1px, transparent 1px)
        `,
        backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
      }}
    />
  )
}
