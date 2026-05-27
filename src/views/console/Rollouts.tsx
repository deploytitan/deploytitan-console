'use client'

/**
 * Rollouts page — Titan Rollout product.
 * Route: /rollouts
 *
 * All deployment strategies across all services: canary, blue-green, ring.
 *
 * Design notes:
 * - 3-tile SummaryTile grid replaced with StatStrip in header (§7.3).
 * - Container radius 2px → 4px (§7.1).
 * - Filter tabs carry per-status count badges.
 * - Expanded rows use animate-slide-down.
 * - Page mounts with animate-fade-up.
 * - DemoBanner rendered unconditionally — page has no real-data path yet.
 *   TODO: guard with demo flag when live data is wired.
 */

import { Link, useParams, useSearch, useNavigate } from '@/lib/navigation'
import { DEMO_SERVICES } from '../../lib/demo-data'
import type { DemoDeployment, DeployStatus } from '../../lib/demo-data'
import {
  DeployStatusBadge,
  RiskBadge,
  HealthDot,
  MonoLabel,
  DemoBanner,
  StatStrip,
  timeSince,
  formatTs,
} from '../../components/console/ConsolePrimitives'
import { Rocket, Shield, ChevronRight, ChevronDown, GitPullRequest } from 'lucide-react'

// ─── Flatten deployments ──────────────────────────────────────────────────────

interface FlatDeployment extends DemoDeployment {
  serviceName: string
  serviceHealth: 'healthy' | 'degraded' | 'incident'
  serviceDisplayName: string
}

const ALL_DEPLOYMENTS: FlatDeployment[] = DEMO_SERVICES.flatMap((svc) =>
  svc.deployments.map((dep) => ({
    ...dep,
    serviceName: svc.serviceName,
    serviceHealth: svc.health,
    serviceDisplayName: svc.displayName,
  }))
).sort((a, b) => b.startedAt - a.startedAt)

// ─── Filter config ────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: DeployStatus | 'all' }[] = [
  { label: 'All',          value: 'all' },
  { label: 'Active',       value: 'canary' },
  { label: 'Deployed',     value: 'completed' },
  { label: 'Failed',       value: 'failed' },
  { label: 'Rolled back',  value: 'rolled_back' },
]

function countByStatus(status: DeployStatus) {
  return ALL_DEPLOYMENTS.filter((d) => d.status === status).length
}

// ─── Header stats ─────────────────────────────────────────────────────────────

const STAT_ITEMS: { label: string; value: string; colorClass?: string }[] = [
  {
    label: 'active rollouts',
    value: String(countByStatus('canary')),
    ...(countByStatus('canary') > 0 ? { colorClass: 'text-signal-deploy' } : {}),
  },
  {
    label: 'deployments total',
    value: String(ALL_DEPLOYMENTS.length),
  },
  {
    label: 'failed',
    value: String(countByStatus('failed')),
    ...(countByStatus('failed') > 0 ? { colorClass: 'text-signal-danger' } : {}),
  },
  {
    label: 'rolled back',
    value: String(countByStatus('rolled_back')),
    ...(countByStatus('rolled_back') > 0 ? { colorClass: 'text-signal-warning' } : {}),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RolloutsPage() {
  const { orgId: orgSlug, projectId: projectSlug } = useParams({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/rollouts' })
  const search = useSearch({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/rollouts' })
  const navigate = useNavigate({ from: '/orgs/$orgId/projects/$projectId/rollouts' })

  const filter = search.status as DeployStatus | 'all'
  const setFilter = (v: DeployStatus | 'all') =>
    navigate({ search: (prev) => ({ ...prev, status: v, deployment: undefined }) })

  const expandedId = search.deployment ?? null
  const setExpandedId = (id: string | null) =>
    navigate({ search: (prev) => ({ ...prev, deployment: id ?? undefined }) })

  const filtered = filter === 'all'
    ? ALL_DEPLOYMENTS
    : ALL_DEPLOYMENTS.filter((d) => d.status === filter)

  return (
    <div className="min-h-full">
      {/* TODO: guard with demo flag */}
      <DemoBanner />

      <div className="px-8 py-10 animate-fade-up">
        {/* Page header */}
        <div className="mb-8 flex items-start gap-3">
          <Rocket size={18} strokeWidth={1.5} className="text-ink-tertiary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1
              className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
            >
              Rollouts
            </h1>
            <p className="text-[12px] text-ink-tertiary mb-3">
              All deployments across your fleet. Canary, blue-green, and ring strategies.
            </p>
            <StatStrip items={STAT_ITEMS} />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-line">
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'all'
              ? ALL_DEPLOYMENTS.length
              : countByStatus(f.value as DeployStatus)
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 text-[11px] border-b-2 -mb-px transition-colors duration-150',
                  filter === f.value
                    ? 'border-ink text-ink font-medium'
                    : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
                ].join(' ')}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className={[
                      'inline-flex items-center justify-center rounded-full text-[9px] px-1.5 min-w-[18px] h-[18px] leading-none transition-colors duration-150',
                      filter === f.value ? 'bg-ink text-surface' : 'bg-line text-ink-quaternary',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Result count */}
        <div className="mb-3">
          <span
            className="text-[10px] text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {filtered.length} deployment{filtered.length !== 1 ? 's' : ''}
            {filter !== 'all' ? ` · ${STATUS_FILTERS.find((f) => f.value === filter)?.label}` : ''}
          </span>
        </div>

        {/* Deployment table */}
        {filtered.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-line px-6 py-8 text-center animate-fade-in">
            <p className="text-[12px] text-ink-tertiary">No deployments match this filter.</p>
          </div>
        ) : (
          <div className="rounded-[4px] border border-line overflow-hidden">
            {/* Table header */}
            <div
              className="grid gap-3 px-4 py-2 bg-surface-alt border-b border-line"
              style={{ gridTemplateColumns: '140px 1fr 70px 90px 80px 72px 24px' }}
            >
              {['SERVICE', 'VERSION / PR', 'RISK', 'STATUS', 'STARTED', 'DURATION', ''].map((col) => (
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
              {filtered.map((dep) => (
                <DeploymentRow
                  key={dep.id}
                  dep={dep}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  expanded={expandedId === dep.id}
                  onToggle={() => setExpandedId(expandedId === dep.id ? null : dep.id)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Deployment row ───────────────────────────────────────────────────────────

function DeploymentRow({
  dep,
  orgSlug,
  projectSlug,
  expanded,
  onToggle,
}: {
  dep: FlatDeployment
  orgSlug: string | null
  projectSlug: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const durationMs = dep.completedAt ? dep.completedAt - dep.startedAt : null
  const durationLabel = durationMs
    ? durationMs < 60000
      ? `${Math.round(durationMs / 1000)}s`
      : `${Math.round(durationMs / 60000)}m`
    : dep.status === 'canary'
    ? 'live'
    : '—'

  return (
    <li>
      <button
        className="w-full text-left grid gap-3 items-start px-4 py-4 bg-surface hover:bg-surface-alt transition-colors duration-150 group"
        style={{ gridTemplateColumns: '140px 1fr 70px 90px 80px 72px 24px' }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {/* Service */}
        <div className="flex items-center gap-1.5 min-w-0">
          <HealthDot health={dep.serviceHealth} />
          <div className="min-w-0">
            <span
              className="text-[11px] text-ink font-medium truncate block"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {dep.serviceName}
            </span>
          </div>
        </div>

        {/* Version / PR */}
        <div className="min-w-0">
          <span
            className="text-[12px] text-ink font-medium block leading-snug"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {dep.version}
          </span>
          <span className="text-[10px] text-ink-tertiary truncate flex items-center gap-1 leading-snug">
            <GitPullRequest size={9} strokeWidth={2} className="shrink-0" />
            #{dep.prNumber} — {dep.prTitle}
          </span>
        </div>

        {/* Risk */}
        <div className="pt-0.5">
          <RiskBadge level={dep.prRiskLevel} score={dep.prRiskScore} />
        </div>

        {/* Status */}
        <div className="pt-0.5 space-y-1">
          <DeployStatusBadge status={dep.status} />
          {dep.rollbackEvent && (
            <div className="flex items-center gap-1">
              <Shield size={8} className="text-signal-danger" />
              <span
                className="text-[8px] text-signal-danger uppercase tracking-[0.06em]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                phoenix
              </span>
            </div>
          )}
        </div>

        {/* Started */}
        <MonoLabel dim>{timeSince(dep.startedAt)}</MonoLabel>

        {/* Duration */}
        <MonoLabel dim>{durationLabel}</MonoLabel>

        {/* Expand */}
        <span
          className={[
            'self-center text-ink-quaternary transition-transform duration-150 ease-out',
            expanded ? 'rotate-180' : 'rotate-0',
          ].join(' ')}
          aria-hidden
        >
          <ChevronDown size={12} strokeWidth={1.75} />
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-line/50 bg-surface-alt animate-slide-down">
          {/* Meta row */}
          <div className="grid grid-cols-4 gap-x-6 gap-y-3 mb-4">
            <DetailCell label="Commit" value={dep.commitSha} mono />
            <DetailCell label="Branch" value={dep.branch} mono />
            <DetailCell label="Author" value={dep.prAuthor} mono />
            <DetailCell label="Started" value={formatTs(dep.startedAt)} mono />
            {dep.env && <DetailCell label="Env" value={dep.env} mono />}
            {dep.strategy && <DetailCell label="Strategy" value={dep.strategy} mono />}
            {dep.status === 'canary' && (
              <DetailCell label="Canary weight" value={`${dep.canaryWeight}% canary · ${dep.stableWeight}% stable`} mono />
            )}
          </div>

          {/* Gates */}
          {dep.gates.length > 0 && (
            <div className="mb-3">
              <p
                className="text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-2"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                Promotion gates
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {dep.gates.map((gate) => {
                  const statusColor =
                    gate.status === 'passed'  ? 'text-signal-success' :
                    gate.status === 'failed'  ? 'text-signal-danger' :
                    gate.status === 'pending' ? 'text-signal-warning' :
                    'text-ink-quaternary'
                  return (
                    <div key={gate.name} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-ink-secondary truncate">{gate.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="text-[10px] text-ink-tertiary"
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {gate.value}
                        </span>
                        <span
                          className={['text-[9px] uppercase tracking-[0.06em]', statusColor].join(' ')}
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {gate.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Phoenix event */}
          {dep.rollbackEvent && (
            <div className="mb-3 flex items-center gap-2 pt-2 border-t border-line/50">
              <Shield size={11} strokeWidth={1.75} className="text-signal-danger shrink-0" />
              <span className="text-[11px] text-signal-danger">
                Phoenix rolled back in {(dep.rollbackEvent.recoveryMs / 1000).toFixed(1)}s after SLO breach
                · scope: {dep.rollbackEvent.scope}
              </span>
            </div>
          )}

          {/* Link to service */}
          <Link
            to="/orgs/$orgId/projects/$projectId/services/$serviceName"
            params={{ orgId: orgSlug!, projectId: projectSlug!, serviceName: encodeURIComponent(dep.serviceName) }}
            className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary hover:text-ink transition-colors duration-150"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            View {dep.serviceName}
            <ChevronRight size={11} strokeWidth={1.75} />
          </Link>
        </div>
      )}
    </li>
  )
}

function DetailCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p
        className="text-[9px] uppercase tracking-[0.08em] text-ink-quaternary mb-0.5"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </p>
      <p
        className="text-[11px] text-ink-secondary break-all"
        style={mono ? { fontFamily: 'JetBrains Mono, monospace' } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
