'use client'

/**
 * SignUpProfile — post-OAuth profiling form.
 * Route: /signup/profile
 *
 * Shown immediately after a new user completes OAuth. Collects five fields
 * used for onboarding personalisation. CTA advances to /onboarding/create-org.
 * "Skip for now" bypasses the step but still moves forward.
 *
 * Step indicator: 1 · Create account  →  2 · Your profile  →  3 · Set up org  →  4 · Invite team
 */

import { useState } from 'react'
import { useNavigate } from '@/lib/navigation'
import { useMutation } from '@tanstack/react-query'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { apiRequest } from '../lib/api'

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

const JOB_TITLES = [
  'Software Engineer',
  'Engineering Manager',
  'DevOps / Platform Engineer',
  'Site Reliability Engineer',
  'CTO / VP Engineering',
  'Product Manager',
  'Other',
]

const HEAR_ABOUT = [
  'Search engine',
  'GitHub / open-source',
  'Colleague referral',
  'Conference / event',
  'Social media',
  'Newsletter / blog',
  'Other',
]

const TEAM_SIZES = ['Just me', '2–5', '6–15', '16–50', '51–200', '200+']

const USE_CASES = [
  'Safer production deployments',
  'Automated rollback',
  'PR environment preview',
  'Deploy monitoring & alerts',
  'Compliance / audit trail',
  'Other',
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProfileNav() {
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

/** Horizontal step indicator — current step is highlighted in amber */
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0" role="list" aria-label="Onboarding steps">
      {STEPS.map((step, i) => {
        const done = step.n < current
        const active = step.n === current
        return (
          <div key={step.n} className="flex items-center" role="listitem">
            {/* Node */}
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
                  color: active
                    ? 'var(--color-ink-secondary)'
                    : 'var(--color-ink-quaternary)',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line — not after last item */}
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

interface SelectFieldProps {
  id: string
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  required?: boolean
}

function SelectField({ id, label, options, value, onChange, required }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-mono uppercase tracking-[0.08em] text-ink-secondary"
      >
        {label}
        {required && <span className="ml-1 text-primary" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full appearance-none bg-surface border border-line text-sm text-ink
                     px-3 py-2.5 pr-8
                     focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
                     transition-colors cursor-pointer"
          style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
        >
          <option value="" disabled>Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {/* Custom caret */}
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-quaternary"
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="2 4 6 8 10 4" />
        </svg>
      </div>
    </div>
  )
}

interface TextFieldProps {
  id: string
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}

function TextField({ id, label, placeholder, value, onChange, required }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-mono uppercase tracking-[0.08em] text-ink-secondary"
      >
        {label}
        {required && <span className="ml-1 text-primary" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-surface border border-line text-sm text-ink placeholder:text-ink-quaternary
                   px-3 py-2.5
                   focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
                   transition-colors"
        style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ProfilePayload {
  jobTitle: string
  hearAbout: string
  teamSize: string
  useCase: string
  companyName: string
}

export function SignUpProfile() {
  const navigate = useNavigate()

  const [form, setForm] = useState<ProfilePayload>({
    jobTitle: '',
    hearAbout: '',
    teamSize: '',
    useCase: '',
    companyName: '',
  })

  const set = (key: keyof ProfilePayload) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }))

  const allFilled = Object.values(form).every((v) => v.trim() !== '')

  const submitMutation = useMutation({
    mutationFn: (payload: ProfilePayload) =>
      apiRequest('/onboarding/profile', {
        method: 'POST',
        json: payload,
      }),
    onSuccess: () => {
      void navigate({ to: '/onboarding/create-org', replace: true })
    },
    onError: () => {
      // Optimistic: navigate anyway — profile is non-blocking
      void navigate({ to: '/onboarding/create-org', replace: true })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!allFilled) return
    submitMutation.mutate(form)
  }

  const handleSkip = () => {
    void navigate({ to: '/onboarding/create-org', replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface relative overflow-hidden">
      <ProfileNav />

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
          <StepIndicator current={2} />
        </div>

        {/* Card */}
        <div
          className="relative w-full max-w-md border border-line corner-accent bg-surface-alt animate-fade-up"
          style={{ borderRadius: '2px' }}
        >
          {/* Amber top-edge accent */}
          <div className="gold-line" />

          <div className="p-8 sm:p-10 space-y-7">
            {/* Heading */}
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-tertiary">
                Step 2 of 4
              </p>
              <h1
                className="text-xl font-semibold tracking-tight text-ink"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
              >
                Tell us about yourself
              </h1>
              <p
                className="text-sm text-ink-tertiary"
                style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              >
                Helps us tailor the experience. Takes under a minute.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-line-subtle" />

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <TextField
                id="companyName"
                label="Company name"
                placeholder="Acme Corp"
                value={form.companyName}
                onChange={set('companyName')}
                required
              />

              <SelectField
                id="jobTitle"
                label="Job title"
                options={JOB_TITLES}
                value={form.jobTitle}
                onChange={set('jobTitle')}
                required
              />

              <SelectField
                id="teamSize"
                label="Team size"
                options={TEAM_SIZES}
                value={form.teamSize}
                onChange={set('teamSize')}
                required
              />

              <SelectField
                id="useCase"
                label="Primary use case"
                options={USE_CASES}
                value={form.useCase}
                onChange={set('useCase')}
                required
              />

              <SelectField
                id="hearAbout"
                label="How did you hear about us"
                options={HEAR_ABOUT}
                value={form.hearAbout}
                onChange={set('hearAbout')}
                required
              />

              {/* CTA */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={!allFilled || submitMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3
                             bg-ink text-surface text-sm font-medium
                             hover:bg-ink/90 active:scale-[0.97]
                             transition-all duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
                  style={{ borderRadius: '2px' }}
                >
                  {submitMutation.isPending ? (
                    <>
                      <span
                        className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"
                        aria-hidden="true"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue to setup
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
                  onClick={handleSkip}
                  className="w-full text-center text-[11px] font-mono text-ink-quaternary hover:text-ink-secondary
                             transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-[2px]"
                >
                  Skip for now
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] font-mono text-ink-quaternary uppercase tracking-[0.08em]">
          Secure via WorkOS
        </p>
      </div>
    </div>
  )
}
