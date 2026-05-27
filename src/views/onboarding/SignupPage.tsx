'use client'

/**
 * SignupPage — self-serve onboarding entry point.
 * Route: /signup (public, no auth required)
 *
 * Collects name, work email, and company name then calls
 * POST /onboarding/signup. On success a magic-auth email is sent; we show
 * a confirmation screen so the user knows to check their inbox.
 */

import { useState } from 'react'
import { apiRequest } from '../../lib/api'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SignupFormValues {
  firstName: string
  lastName: string
  email: string
  companyName: string
}

interface SignupResponse {
  orgId: string
  workosOrgId: string
  magicLinkSent: boolean
  message: string
}

// ── Blueprint grid (reused visual motif) ──────────────────────────────────────

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

// ── Form ──────────────────────────────────────────────────────────────────────

const inputClass = [
  'w-full px-3 py-2 rounded-[4px] border border-line bg-surface text-[13px] text-ink',
  'placeholder:text-ink-quaternary',
  'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:border-primary/60',
  'transition-colors',
].join(' ')

const labelClass = 'block text-[11px] font-mono uppercase tracking-[0.08em] text-ink-tertiary mb-1'

function Field({
  label,
  id,
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageState = 'form' | 'success' | 'error'

export function SignupPage() {
  const [state, setState] = useState<PageState>('form')
  const [values, setValues] = useState<SignupFormValues>({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    try {
      await apiRequest<SignupResponse>('/onboarding/signup', {
        method: 'POST',
        json: values,
        skipAuth: true,
      })
      setSentEmail(values.email)
      setState('success')
    } catch (err) {
      console.error('[SignupPage] signup request failed', err)
      logFrontendEvent({ level: 'error', message: 'signup.request.failed', context: { error: err } })
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setErrorMessage(msg)
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="relative min-h-screen bg-surface flex items-center justify-center px-6"
      aria-label="Sign up for DeployTitan"
    >
      <BlueprintGrid />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center h-14 px-8 border-b border-line-subtle">
        <span
          className="text-sm font-semibold tracking-tight text-gold"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          DeployTitan
        </span>
      </div>

      <div className="relative z-10 w-full max-w-[420px] py-20">
        {state === 'success' ? (
          <SuccessPanel email={sentEmail} />
        ) : (
          <SignupForm
            values={values}
            submitting={submitting}
            errorMessage={errorMessage}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SignupForm({
  values,
  submitting,
  errorMessage,
  onChange,
  onSubmit,
}: {
  values: SignupFormValues
  submitting: boolean
  errorMessage: string | null
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-[22px] font-semibold tracking-tight text-ink leading-snug"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          Get started with DeployTitan
        </h1>
        <p className="mt-1 text-[13px] text-ink-tertiary">
          Create your workspace — no credit card required.
        </p>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          value={values.firstName}
          onChange={onChange}
          placeholder="Jane"
        />
        <Field
          label="Last name"
          id="lastName"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          value={values.lastName}
          onChange={onChange}
          placeholder="Smith"
        />
      </div>

      <Field
        label="Work email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={values.email}
        onChange={onChange}
        placeholder="jane@acme.com"
      />

      <Field
        label="Company name"
        id="companyName"
        name="companyName"
        type="text"
        autoComplete="organization"
        required
        value={values.companyName}
        onChange={onChange}
        placeholder="Acme Corp"
      />

      {errorMessage && (
        <p className="text-[12px] text-red-500 font-mono">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={[
          'w-full py-2.5 rounded-[4px] text-[13px] font-medium transition-opacity',
          'bg-primary text-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-primary',
          submitting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90',
        ].join(' ')}
      >
        {submitting ? 'Creating workspace…' : 'Create workspace'}
      </button>

      <p className="text-center text-[12px] text-ink-tertiary">
        Already have an account?{' '}
        <a
          href="/login"
          className="text-primary hover:underline focus:outline-none focus-visible:underline"
        >
          Sign in
        </a>
      </p>
    </form>
  )
}

function SuccessPanel({ email }: { email: string }) {
  return (
    <div className="text-center space-y-4">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center"
        style={{
          borderRadius: '4px',
          border: '1px solid var(--color-primary)',
          background: 'var(--color-primary-subtle, oklch(0.96 0.04 85))',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>

      <h2
        className="text-[20px] font-semibold tracking-tight text-ink"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        Check your inbox
      </h2>

      <p className="text-[13px] text-ink-secondary leading-relaxed">
        We sent a magic sign-in link to{' '}
        <span className="font-medium text-ink">{email}</span>. Click the link
        to access your new workspace.
      </p>

      <p className="text-[12px] text-ink-tertiary">
        Didn't receive it? Check your spam folder or{' '}
        <button
          onClick={() => window.location.reload()}
          className="text-primary hover:underline focus:outline-none focus-visible:underline"
        >
          try again
        </button>
        .
      </p>
    </div>
  )
}
