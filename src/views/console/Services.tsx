'use client'

/**
 * Services page — list of services for the selected project.
 * Shows demo data when no real services exist.
 *
 * Design notes:
 * - Container radius 2px → 4px (§7.1).
 * - Page mounts with animate-fade-up; rows stagger with animate-stagger.
 * - ServiceRow shows service name, team, description, version, strategy, health, error rate, p99.
 * - Active canary indicated with inline CANARY badge next to version.
 * - Empty state uses dashed border with improved copy.
 * - Service count folded into header prose (not a tile).
 */

import { Link, useParams } from '@/lib/navigation'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'
import { ChevronRight, Zap, Server } from 'lucide-react'
import { isDemoMode, DEMO_SERVICES } from '../../hooks/useDemoMode'
import {
  HealthDot,
  DeployStatusBadge,
  MonoLabel,
  DemoBanner,
  timeSince,
} from '../../components/console/ConsolePrimitives'
import type { DemoService } from '../../lib/demo-data'

export function Services() {
  const [serviceRows] = useQuery(queries.allServices({}))
  const demo = isDemoMode(serviceRows)
  const services: DemoService[] = demo ? DEMO_SERVICES : []
  const { orgId, projectId } = useParams({ strict: false }) as { orgId?: string; projectId?: string }

  const healthyCount  = services.filter((s) => s.health === 'healthy').length
  const degradedCount = services.filter((s) => s.health === 'degraded').length
  const incidentCount = services.filter((s) => s.health === 'incident').length

  return (
    <div className="min-h-full">
      {demo && <DemoBanner />}

      <div className="px-8 py-10 animate-fade-up">
        {/* Page header */}
        <div className="mb-8 flex items-start gap-3">
          <Server size={18} strokeWidth={1.5} className="text-ink-tertiary mt-0.5 shrink-0" />
          <div>
            <h1
              className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
            >
              Services
            </h1>
            {services.length > 0 ? (
              <p className="text-[12px] text-ink-tertiary">
                {services.length} service{services.length !== 1 ? 's' : ''} connected
                {incidentCount > 0 && (
                  <span className="ml-2 text-signal-danger">
                    · {incidentCount} incident{incidentCount !== 1 ? 's' : ''}
                  </span>
                )}
                {degradedCount > 0 && incidentCount === 0 && (
                  <span className="ml-2 text-signal-warning">
                    · {degradedCount} degraded
                  </span>
                )}
                {incidentCount === 0 && degradedCount === 0 && (
                  <span className="ml-2 text-signal-success">· all healthy</span>
                )}
              </p>
            ) : (
              <p className="text-[12px] text-ink-tertiary">No services connected yet.</p>
            )}
          </div>
        </div>

        {services.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-[4px] border border-line overflow-hidden">
            {/* Table header */}
            <div
              className="grid gap-4 px-4 py-2 bg-surface-alt border-b border-line"
              style={{ gridTemplateColumns: '1fr 110px 90px 72px 72px 72px 80px' }}
            >
              {['SERVICE', 'ACTIVE VER', 'STRATEGY', 'HEALTH', 'ERROR', 'P99', 'DEPLOYED'].map((col) => (
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
              {services.map((svc) => <ServiceRow key={svc.id} service={svc} orgId={orgId ?? null} projectId={projectId ?? null} />)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Service row ──────────────────────────────────────────────────────────────

function ServiceRow({ service, orgId, projectId }: { service: DemoService; orgId: string | null; projectId: string | null }) {
  const latestDep = service.deployments[0]
  const isCanary  = latestDep?.status === 'canary'

  const svcPath = orgId && projectId
    ? { to: '/orgs/$orgId/projects/$projectId/services/$serviceName' as const, params: { orgId: orgId!, projectId: projectId!, serviceName: encodeURIComponent(service.serviceName) } }
    : { to: '/onboarding/create-org' as const }

  return (
    <li>
      <Link
        {...svcPath}
        className="grid gap-4 items-center px-4 py-4 bg-surface hover:bg-surface-alt transition-colors duration-150 group"
        style={{ gridTemplateColumns: '1fr 110px 90px 72px 72px 72px 80px' }}
      >
        {/* Name + team + description */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-1.5 shrink-0">
            <HealthDot health={service.health} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[12px] font-medium text-ink truncate"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {service.serviceName}
              </span>
              <ChevronRight
                size={11}
                strokeWidth={1.75}
                className="opacity-0 group-hover:opacity-60 text-ink-quaternary transition-opacity duration-150 shrink-0"
              />
            </div>
            <p className="text-[10px] text-ink-quaternary truncate leading-snug">
              {service.team} · {service.description}
            </p>
          </div>
        </div>

        {/* Active version */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[11px] text-ink-secondary truncate"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {service.activeVersion}
          </span>
          {isCanary && (
            <Zap size={9} className="text-signal-deploy shrink-0" strokeWidth={2.5} aria-label="Canary active" />
          )}
        </div>

        {/* Strategy */}
        <MonoLabel dim>{service.routingStrategy}</MonoLabel>

        {/* Health */}
        <span
          className={[
            'text-[10px] capitalize',
            service.health === 'healthy'  ? 'text-signal-success' :
            service.health === 'degraded' ? 'text-signal-warning' :
            'text-signal-danger',
          ].join(' ')}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {service.health}
        </span>

        {/* Error rate */}
        <span
          className={[
            'text-[10px]',
            service.errorRate >= 1   ? 'text-signal-danger' :
            service.errorRate >= 0.3 ? 'text-signal-warning' :
            'text-ink-tertiary',
          ].join(' ')}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {service.errorRate.toFixed(2)}%
        </span>

        {/* p99 latency */}
        <span
          className={[
            'text-[10px]',
            service.p99Latency >= 500 ? 'text-signal-danger' :
            service.p99Latency >= 200 ? 'text-signal-warning' :
            'text-ink-tertiary',
          ].join(' ')}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {service.p99Latency}ms
        </span>

        {/* Last deployed */}
        <span
          className="text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {timeSince(service.lastDeployedAt)}
        </span>
      </Link>
    </li>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-[4px] border border-dashed border-line px-6 py-10 text-center animate-fade-in">
      <p
        className="text-[13px] font-medium text-ink mb-1.5"
        style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
      >
        No services connected.
      </p>
      <p className="text-[11px] text-ink-tertiary mb-5 max-w-sm mx-auto leading-relaxed">
        Connect a service to start tracking deployments, rollouts, and incidents.
        Takes about 3 minutes.
      </p>
      <code
        className="inline-block rounded-[4px] border border-line bg-surface-alt px-3 py-1.5 text-[11px] text-ink-tertiary"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        dt connect --service my-api --project my-project
      </code>
    </div>
  )
}
