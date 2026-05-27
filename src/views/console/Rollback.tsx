'use client'

/**
 * Rollback page — powered by Titan Phoenix.
 * Route: /rollback
 *
 * Surfaces:
 * 1. Inline stat strip in the header — 30-day summary without hero-metric tiles.
 * 2. History table — all Phoenix rollback events, expandable rows.
 * 3. Manual trigger — inline form below the header (no modal).
 *
 * Safety improvements:
 * - Form has error state with retry, no auto-dismiss on success.
 * - Warns if the selected service has an active canary deployment.
 * - Submit button uses text-surface (on-brand) not text-white (banned).
 */

import { useState } from 'react'
import { Link, useParams, useSearch, useNavigate } from '@/lib/navigation'
import { DEMO_INCIDENTS, DEMO_SERVICES } from '../../lib/demo-data'
import type { DemoIncident } from '../../lib/demo-data'
import {
  DemoBanner,
  MonoLabel,
  SectionHeader,
  StatStrip,
  timeSince,
  formatTs,
} from '../../components/console/ConsolePrimitives'
import { RotateCcw, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react'

// ─── Stats ────────────────────────────────────────────────────────────────────

const totalRollbacks     = DEMO_INCIDENTS.length
const resolvedRollbacks  = DEMO_INCIDENTS.filter((i) => i.status === 'resolved').length
const meanRecoveryMs     = DEMO_INCIDENTS.filter((i) => i.recoveryMs != null)
  .reduce((acc, i) => acc + (i.recoveryMs ?? 0), 0) /
  (DEMO_INCIDENTS.filter((i) => i.recoveryMs != null).length || 1)

// Service names for trigger form
const ALL_SERVICE_NAMES = DEMO_SERVICES.map((s) => s.serviceName)

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RollbackPage() {
  const { orgId: orgSlug, projectId: projectSlug } = useParams({ strict: false }) as { orgId?: string; projectId?: string }
  const search = useSearch({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/rollback' })
  const navigate = useNavigate({ from: '/orgs/$orgId/projects/$projectId/rollback' })

  const [triggerOpen, setTriggerOpen] = useState(false)

  const expandedId = search.incident ?? null
  const setExpandedId = (id: string | null) =>
    navigate({ search: (prev) => ({ ...prev, incident: id ?? undefined }) })

  return (
    <div className="min-h-full">
      {/* TODO: guard with demo flag */}
      <DemoBanner />

      <div className="px-8 py-10 animate-fade-up">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <RotateCcw size={18} strokeWidth={1.5} className="text-ink-tertiary mt-0.5 shrink-0" />
            <div>
              <h1
                className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
              >
                Rollback
              </h1>
              <p className="text-[12px] text-ink-tertiary mb-2">
                Powered by Titan Phoenix. Automated recovery and manual rollback controls.
              </p>
              {/* Inline stat strip — replaces 3-tile grid */}
              <StatStrip items={[
                { label: 'rollbacks (30 days)', value: String(totalRollbacks) },
                {
                  label: 'recovered',
                  value: `${resolvedRollbacks}/${totalRollbacks}`,
                  colorClass: 'text-signal-success',
                },
                {
                  label: 'mean recovery',
                  value: `${(meanRecoveryMs / 1000).toFixed(1)}s`,
                  colorClass: 'text-signal-deploy',
                },
              ]} />
            </div>
          </div>
          <button
            onClick={() => setTriggerOpen((v) => !v)}
            className={[
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[4px] border transition-colors duration-150',
              triggerOpen
                ? 'bg-ink text-surface border-ink'
                : 'bg-surface text-ink border-line hover:border-ink/40',
            ].join(' ')}
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          >
            <RotateCcw size={11} strokeWidth={2} />
            Trigger rollback
          </button>
        </div>

        {/* Manual trigger form — inline, no modal */}
        {triggerOpen && (
          <div className="animate-slide-down">
            <TriggerRollbackForm onClose={() => setTriggerOpen(false)} />
          </div>
        )}

        {/* Rollback history */}
        <section>
          <SectionHeader right={`${DEMO_INCIDENTS.length} events`}>
            Rollback history
          </SectionHeader>

          {DEMO_INCIDENTS.length === 0 ? (
            <EmptyRollbackState />
          ) : (
            <div className="rounded-[4px] border border-line overflow-hidden">
              {/* Table header */}
              <div
                className="grid gap-3 px-4 py-2 bg-surface-alt border-b border-line"
                style={{ gridTemplateColumns: '140px 90px 70px 100px 100px 80px 32px' }}
              >
                {['SERVICE', 'VERSION', 'SCOPE', 'TRIGGER', 'RECOVERY', 'WHEN', ''].map((col) => (
                  <span
                    key={col}
                    className="text-[9px] text-ink-quaternary uppercase tracking-[0.1em]"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {col}
                  </span>
                ))}
              </div>

              <ul className="divide-y divide-line animate-stagger">
                {DEMO_INCIDENTS.map((inc) => (
                  <RollbackRow
                    key={inc.id}
                    incident={inc}
                    orgSlug={orgSlug ?? ''}
                    projectSlug={projectSlug ?? ''}
                    expanded={expandedId === inc.id}
                    onToggle={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Manual trigger form ───────────────────────────────────────────────────────

type FormState = 'idle' | 'submitting' | 'success' | 'error'

function TriggerRollbackForm({ onClose }: { onClose: () => void }) {
  const [service, setService] = useState('')
  const [version, setVersion] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedService = DEMO_SERVICES.find((s) => s.serviceName === service)
  const hasActiveCanary = selectedService?.deployments[0]?.status === 'canary'

  const availableVersions = selectedService
    ? selectedService.deployments
        .filter((d) => d.status === 'completed' || d.status === 'rolled_back')
        .map((d) => d.version)
    : []

  const canSubmit = service && version && confirmed && formState !== 'submitting'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setFormState('submitting')
    setErrorMessage('')

    // Simulate API call — in production this calls the Phoenix API
    setTimeout(() => {
      // Demo: always succeed. Real: handle API error by calling setFormState('error')
      setFormState('success')
    }, 1200)
  }

  const handleRetry = () => {
    setFormState('idle')
    setErrorMessage('')
  }

  if (formState === 'success') {
    return (
      <div className="mb-6 rounded-[4px] border border-signal-success/25 bg-signal-success/5 px-4 py-4 flex items-start gap-3">
        <CheckCircle size={14} strokeWidth={2} className="text-signal-success shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[12px] font-medium text-ink">Rollback initiated</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">
            Rolling{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{service}</span> back to{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{version}</span>. Phoenix is managing recovery.
          </p>
          {reason && (
            <p className="text-[10px] text-ink-quaternary mt-1">
              Reason: {reason}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-ink-quaternary hover:text-ink transition-colors duration-150 shrink-0 p-0.5"
          aria-label="Dismiss"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    )
  }

  if (formState === 'error') {
    return (
      <div className="mb-6 rounded-[4px] border border-signal-danger/25 bg-signal-danger/5 px-4 py-4 flex items-start gap-3">
        <AlertTriangle size={14} strokeWidth={2} className="text-signal-danger shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[12px] font-medium text-ink">Rollback failed to initiate</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">
            {errorMessage || 'Phoenix could not process the request. Check service connectivity and try again.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 text-[11px] text-ink-secondary hover:text-ink transition-colors duration-150"
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          >
            <RefreshCw size={11} strokeWidth={2} />
            Retry
          </button>
          <button
            onClick={onClose}
            className="text-ink-quaternary hover:text-ink transition-colors duration-150 p-0.5"
            aria-label="Dismiss"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-[4px] border border-line bg-surface-alt"
    >
      {/* Form header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <AlertTriangle size={12} strokeWidth={2} className="text-signal-warning" />
          <span className="text-[12px] font-medium text-ink">Manual rollback</span>
          <span className="text-[11px] text-ink-tertiary">
            — this will immediately shift traffic away from the current version
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-quaternary hover:text-ink transition-colors duration-150 p-0.5"
          aria-label="Cancel"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Service + Version row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="block text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-1.5"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Service
            </label>
            <div className="relative">
              <select
                value={service}
                onChange={(e) => { setService(e.target.value); setVersion('') }}
                className="w-full appearance-none rounded-[4px] border border-line bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 transition-colors duration-150"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                <option value="">Select service</option>
                {ALL_SERVICE_NAMES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-quaternary" />
            </div>
            {/* Canary warning — appears inline under the selector */}
            {hasActiveCanary && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-signal-warning animate-fade-in">
                <AlertTriangle size={10} strokeWidth={2} className="shrink-0" />
                This service has an active canary. Rolling back will terminate the canary.
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-1.5"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Roll back to version
            </label>
            <div className="relative">
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={!service}
                className="w-full appearance-none rounded-[4px] border border-line bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                <option value="">Select version</option>
                {availableVersions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-quaternary" />
            </div>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label
            className="block text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            Reason{' '}
            <span className="normal-case tracking-normal text-ink-quaternary/60">(optional)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. elevated error rate on /checkout"
            className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[12px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 transition-colors duration-150"
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          />
        </div>

        {/* Confirmation + submit */}
        <div className="pt-1 flex items-start justify-between gap-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-ink rounded-[2px]"
            />
            <span className="text-[11px] text-ink-secondary leading-snug">
              I understand this will immediately route traffic away from the current version.
            </span>
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              'shrink-0 flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium rounded-[4px] transition-colors duration-150',
              canSubmit
                ? 'bg-signal-danger text-surface hover:bg-signal-danger/90'
                : 'bg-line text-ink-quaternary cursor-not-allowed',
            ].join(' ')}
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          >
            {formState === 'submitting' ? (
              <>
                <RefreshCw size={11} strokeWidth={2} className="animate-spin" />
                Initiating...
              </>
            ) : (
              'Confirm rollback'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── Rollback row ─────────────────────────────────────────────────────────────

function RollbackRow({
  incident,
  orgSlug,
  projectSlug,
  expanded,
  onToggle,
}: {
  incident: DemoIncident
  orgSlug: string
  projectSlug: string
  expanded: boolean
  onToggle: () => void
}) {
  const isActive = incident.status === 'active'
  const recoveryLabel = incident.recoveryMs != null
    ? `${(incident.recoveryMs / 1000).toFixed(1)}s`
    : isActive ? 'in progress' : '—'

  const recoveryColor = isActive
    ? 'text-signal-warning'
    : incident.recoveryMs != null
    ? 'text-signal-success'
    : 'text-ink-quaternary'

  const scopeLabel = incident.scope

  return (
    <li>
      <button
        className="w-full text-left grid gap-3 items-center px-4 py-4 bg-surface hover:bg-surface-alt transition-colors duration-150 group"
        style={{ gridTemplateColumns: '140px 90px 70px 100px 100px 80px 32px' }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {/* Service */}
        <div className="flex items-center gap-2 min-w-0">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-signal-danger animate-pulse-dot shrink-0" />
          )}
          <span
            className="text-[12px] font-medium text-ink truncate"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {incident.service}
          </span>
        </div>

        {/* Version */}
        <MonoLabel dim>{incident.version}</MonoLabel>

        {/* Scope */}
        <MonoLabel dim>{scopeLabel}</MonoLabel>

        {/* Trigger */}
        <span
          className="text-[10px] text-ink-tertiary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
          title={`Error rate at trigger: ${incident.errorRateAtTrigger.toFixed(1)}%`}
        >
          {`${incident.errorRateAtTrigger.toFixed(1)}% err`}
        </span>
        <span
          className={['text-[10px] flex items-center gap-1', recoveryColor].join(' ')}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {isActive && <Clock size={9} strokeWidth={2} className="shrink-0" />}
          {recoveryLabel}
        </span>

        {/* When */}
        <MonoLabel dim>{timeSince(incident.triggeredAt)}</MonoLabel>

        {/* Expand chevron */}
        <span
          className={[
            'flex items-center justify-center text-ink-quaternary transition-transform duration-200 ease-out',
            expanded ? 'rotate-90' : 'rotate-0',
          ].join(' ')}
        >
          <ChevronRight size={12} strokeWidth={1.75} />
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-line/60 bg-surface-alt animate-slide-down">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <DetailRow label="Triggered at" value={formatTs(incident.triggeredAt)} />
              {incident.resolvedAt && (
                <DetailRow label="Resolved at" value={formatTs(incident.resolvedAt)} />
              )}
              <DetailRow
                label="Error rate at trigger"
                value={`${incident.errorRateAtTrigger.toFixed(2)}%`}
                valueClass="text-signal-danger"
              />
              {incident.recoveryMs && (
                <DetailRow
                  label="Recovery time"
                  value={`${(incident.recoveryMs / 1000).toFixed(1)}s`}
                  valueClass="text-signal-success"
                />
              )}
            </div>
            <div className="space-y-2">
              <DetailRow label="Status" value={incident.status} />
              <DetailRow label="Affected requests" value={String(incident.affectedRequests)} />
              <Link
                to="/orgs/$orgId/projects/$projectId/ledger"
                params={{ orgId: orgSlug!, projectId: projectSlug! }}
                className="flex items-center gap-1 text-[10px] text-ink-tertiary hover:text-ink transition-colors duration-150 mt-2"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                View in Ledger
                <ChevronRight size={9} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[9px] uppercase tracking-[0.08em] text-ink-quaternary w-28 shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </span>
      <span
        className={['text-[11px]', valueClass ?? 'text-ink-secondary'].join(' ')}
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {value}
      </span>
    </div>
  )
}

function EmptyRollbackState() {
  return (
    <div className="rounded-[4px] border border-dashed border-line px-6 py-10 text-center animate-fade-in">
      <CheckCircle size={16} strokeWidth={1.5} className="text-signal-success/60 mx-auto mb-3" />
      <p className="text-[13px] font-medium text-ink mb-1">No rollbacks in the past 30 days.</p>
      <p className="text-[11px] text-ink-tertiary max-w-xs mx-auto leading-relaxed">
        Phoenix hasn't had to intervene. All deployments have stayed within their SLO thresholds.
      </p>
    </div>
  )
}
