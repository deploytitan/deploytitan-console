'use client'

/**
 * CreateOrganizationForm — shared form used in two contexts:
 *   1. The standalone /onboarding/create-org page (full-screen, no sidebar)
 *   2. The /overview empty state (inline, within console chrome)
 *
 * Props:
 *   onSuccess  — called with the created org after API success
 *   compact    — when true, reduces heading size for the inline context
 */

import { useId, useState } from 'react'
import { useNavigate } from '@/lib/navigation'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useCreateOrganization } from '../../hooks/useCreateOrganization'
import { cn } from '../../lib/utils'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

interface CreateOrganizationFormProps {
  onSuccess?: (org: { workosOrgId: string; name: string }) => void
  compact?: boolean
}

export function CreateOrganizationForm({ onSuccess, compact }: CreateOrganizationFormProps) {
  const nameId = useId()
  const [name, setName] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { create, isPending, connectionState } = useCreateOrganization()
  const navigate = useNavigate()
  const isConnected = connectionState.name === 'connected'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitError(null)

    try {
      const org = await create({ name: name.trim() })

      if (onSuccess) {
        onSuccess(org)
      } else {
        navigate({ to: '/orgs/$orgId', params: { orgId: org.workosOrgId }, replace: true })
      }
    } catch (err) {
      console.error('[CreateOrganizationForm] org creation failed', err)
      logFrontendEvent({ level: 'error', message: 'org.create.failed', context: { error: err } })
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.'
      setSubmitError(message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Heading block */}
      <div className="space-y-1.5">
        <h2
          className={cn('font-semibold tracking-tight text-ink', compact ? 'text-xl' : 'text-2xl')}
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
        >
          Create your organization
        </h2>
        <p
          className="text-sm text-ink-tertiary"
          style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
        >
          Organizations are the top-level boundary for your deployments, projects, and team
          access.
        </p>
      </div>

      {/* Name field */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-ink">
            Organization name
          </label>
          <Input
            id={nameId}
            placeholder="Acme Engineering"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending || !isConnected}
            autoFocus
            required
          />
        </div>
      </div>

      {/* Connection warning */}
      {!isConnected && (
        <p
          className="text-xs text-signal-warning"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
          role="alert"
        >
          {connectionState.name === 'connecting'
            ? 'Connecting to sync server…'
            : 'Not connected to sync server. Cannot create organization.'}
        </p>
      )}

      {/* API error */}
      {submitError && (
        <p
          className="text-xs text-signal-danger"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
          role="alert"
        >
          {submitError}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={!name.trim() || isPending || !isConnected}
        className="w-full justify-center"
      >
        {isPending ? (
          <>
            <SpinnerIcon />
            Creating…
          </>
        ) : (
          'Create organization'
        )}
      </Button>
    </form>
  )
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path
        d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
