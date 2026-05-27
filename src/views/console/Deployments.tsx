'use client'

/**
 * Deployments page — cross-service deployment timeline (mission control).
 * Route: /deployments
 *
 * Shows all deployments across all services, ordered newest first.
 * Filterable by status. Demo data shown when no real deployments.
 */

import { useState } from 'react'
import { Link, useParams } from '@/lib/navigation'
import { DEMO_SERVICES, DEMO_INCIDENTS } from '../../lib/demo-data'
import type { DemoDeployment, DeployStatus } from '../../lib/demo-data'
import {
  DeployStatusBadge,
  RiskBadge,
  HealthDot,
  SectionHeader,
  MonoLabel,
  DemoBanner,
  timeSince,
  formatTs,
} from '../../components/console/ConsolePrimitives'
import { Shield, ChevronRight, Activity } from 'lucide-react'

// Flatten all deployments across services for the timeline view
interface FlatDeployment extends DemoDeployment {
  serviceName: string
  serviceHealth: 'healthy' | 'degraded' | 'incident'
}

const ALL_DEPLOYMENTS: FlatDeployment[] = DEMO_SERVICES.flatMap((svc) =>
  svc.deployments.map((dep) => ({
    ...dep,
    serviceName: svc.serviceName,
    serviceHealth: svc.health,
  }))
).sort((a, b) => b.startedAt - a.startedAt)

const STATUS_FILTERS: { label: string; value: DeployStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'canary' },
  { label: 'Deployed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Rolled back', value: 'rolled_back' },
]

export function DeploymentsPage() {
  const [filter, setFilter] = useState<DeployStatus | 'all'>('all')
  const { orgId, projectId } = useParams({ strict: false }) as { orgId?: string; projectId?: string }

  const filtered = filter === 'all'
    ? ALL_DEPLOYMENTS
    : ALL_DEPLOYMENTS.filter((d) => d.status === filter)

  const activeCounts = {
    canary: ALL_DEPLOYMENTS.filter((d) => d.status === 'canary').length,
    failed: ALL_DEPLOYMENTS.filter((d) => d.status === 'failed').length,
    rolled_back: ALL_DEPLOYMENTS.filter((d) => d.status === 'rolled_back').length,
  }

  return (
    <div className="min-h-full">
      {/* TODO: guard with demo flag */}
      <DemoBanner />

      <div className="px-8 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
            style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
          >
            Deployments
          </h1>
          <p className="text-[12px] text-ink-tertiary mt-1">
            All releases across your fleet
          </p>
        </div>

        {/* Status summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryTile
            label="Active canaries"
            value={activeCounts.canary}
            color="text-signal-deploy"
            icon={<Activity size={13} strokeWidth={2} className="text-signal-deploy" />}
          />
          <SummaryTile
            label="Failed"
            value={activeCounts.failed}
            color="text-signal-danger"
            icon={<span className="text-signal-danger text-[11px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>✕</span>}
          />
          <SummaryTile
            label="Rolled back"
            value={activeCounts.rolled_back}
            color="text-signal-warning"
            icon={<Shield size={13} strokeWidth={2} className="text-signal-warning" />}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-line pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={[
                'px-3 py-2 text-[11px] border-b-2 -mb-px transition-colors',
                filter === f.value
                  ? 'border-ink text-ink font-medium'
                  : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
              ].join(' ')}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {f.label}
              {f.value !== 'all' && ALL_DEPLOYMENTS.filter((d) => d.status === f.value).length > 0 && (
                <span className="ml-1.5 text-[9px] text-ink-quaternary">
                  {ALL_DEPLOYMENTS.filter((d) => d.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Deployment timeline */}
        <div className="rounded-[2px] border border-line overflow-hidden">
          {/* Table header */}
          <div
            className="grid gap-3 px-4 py-2 bg-surface-alt border-b border-line"
            style={{ gridTemplateColumns: '130px 1fr 70px 80px 80px 80px' }}
          >
            {(['SERVICE', 'VERSION / PR', 'RISK', 'STATUS', 'STARTED', 'DURATION'].map((col) => (
              <span
                key={col}
                className="text-[9px] text-ink-quaternary uppercase tracking-[0.1em]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {col}
              </span>
            )))}
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] text-ink-tertiary">No deployments match this filter.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((dep) => (
                <DeploymentRow key={dep.id} dep={dep} orgId={orgId ?? null} projectId={projectId ?? null} />
              ))}
            </ul>
          )}
        </div>

        {/* Phoenix incidents summary */}
        {DEMO_INCIDENTS.length > 0 && (
          <section className="mt-8">
            <SectionHeader right={`${DEMO_INCIDENTS.length} events`}>
              Phoenix — recent rollbacks
            </SectionHeader>
            <div className="space-y-2">
              {DEMO_INCIDENTS.map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-[2px] border border-signal-danger/15 bg-signal-danger/5"
                >
                  <Shield size={12} strokeWidth={2} className="text-signal-danger shrink-0" />
                  <span className="text-[11px] font-medium text-ink w-36 shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {inc.service}
                  </span>
                  <span className="text-[11px] text-ink-tertiary w-16 shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {inc.version}
                  </span>
                  <span className="text-[10px] text-ink-tertiary">
                    scope: {inc.scope}
                  </span>
                  <span className="text-[10px] text-ink-tertiary">
                    error rate: {inc.errorRateAtTrigger.toFixed(1)}% at trigger
                  </span>
                  {inc.recoveryMs && (
                    <span className="text-[10px] text-signal-success ml-auto shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      recovered in {(inc.recoveryMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  <span className="text-[9px] text-ink-quaternary shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {timeSince(inc.triggeredAt)}
                  </span>
                  <Link
                    {...(orgId && projectId
                      ? { to: '/orgs/$orgId/projects/$projectId/services/$serviceName' as const, params: { orgId, projectId, serviceName: encodeURIComponent(inc.service) } }
                        : { to: '/onboarding/create-org' as const })}
                    className="text-ink-quaternary hover:text-ink transition-colors shrink-0"
                  >
                    <ChevronRight size={12} strokeWidth={1.75} />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[2px] border border-line bg-surface">
      {icon}
      <div>
        <p className={['text-[18px] font-semibold leading-none mb-0.5', color].join(' ')}
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em' }}>
          {value}
        </p>
        <p className="text-[10px] text-ink-quaternary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

function DeploymentRow({ dep, orgId, projectId }: { dep: FlatDeployment; orgId: string | null; projectId: string | null }) {
  const durationMs = dep.completedAt ? dep.completedAt - dep.startedAt : null
  const durationLabel = durationMs
    ? durationMs < 60000
      ? `${Math.round(durationMs / 1000)}s`
      : `${Math.round(durationMs / 60000)}m`
    : dep.status === 'canary' ? 'in progress' : '—'

  return (
    <li
      className="grid gap-3 items-start px-4 py-3 bg-surface hover:bg-surface-alt transition-colors group"
      style={{ gridTemplateColumns: '130px 1fr 70px 80px 80px 80px' }}
    >
      {/* Service */}
      <Link
        {...(orgId && projectId
          ? { to: '/orgs/$orgId/projects/$projectId/services/$serviceName' as const, params: { orgId, projectId, serviceName: encodeURIComponent(dep.serviceName) } }
           : { to: '/onboarding/create-org' as const })}
        className="flex items-center gap-1.5 min-w-0 hover:text-ink-secondary transition-colors"
      >
        <HealthDot health={dep.serviceHealth} />
        <span
          className="text-[11px] text-ink font-medium truncate"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {dep.serviceName}
        </span>
      </Link>

      {/* Version / PR */}
      <div className="min-w-0">
        <span
          className="text-[12px] text-ink font-medium block leading-snug"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {dep.version}
        </span>
        <span className="text-[10px] text-ink-tertiary truncate block leading-snug">
          #{dep.prNumber} — {dep.prTitle}
        </span>
      </div>

      {/* Risk */}
      <div className="pt-0.5">
        <RiskBadge level={dep.prRiskLevel} score={dep.prRiskScore} />
      </div>

      {/* Status */}
      <div className="pt-0.5">
        <DeployStatusBadge status={dep.status} />
        {dep.rollbackEvent && (
          <div className="mt-1 flex items-center gap-1">
            <Shield size={8} className="text-signal-danger" />
            <span className="text-[8px] text-signal-danger" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              phoenix
            </span>
          </div>
        )}
      </div>

      {/* Started */}
      <MonoLabel dim>{timeSince(dep.startedAt)}</MonoLabel>

      {/* Duration */}
      <MonoLabel dim>{durationLabel}</MonoLabel>
    </li>
  )
}
