'use client'

/**
 * ProjectOverviewPage — unified project overview, used at two URLs:
 *
 *   /overview
 *     → If org+project context is set: redirect (handled in router) or render
 *     → If no org: show OrgSetupPrompt
 *     → If org but no project: show NoProjectSelected
 *
 *   /orgs/:orgId/projects/:projectId
 *     → Full project overview with breadcrumb, product zones, services, activity
 *
 * Combines the three-zone product summary from the old Overview page with the
 * rich demo detail (env tabs, service cards, activity feed, project sidebar)
 * from the old ProjectPage.
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearch } from '@/lib/navigation'
import { useQuery } from '@rocicorp/zero/react'
import { queries, type Service } from '@deploytitan/zero-schema'
import { DEV_BYPASS_AUTH } from '../../env'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  GitBranch,
  GitPullRequest,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings2,
  Users,
  Wrench,
  Zap,
} from 'lucide-react'
import {
  DemoBanner,
  DeployStatusBadge,
  formatTs,
  HealthDot,
  MonoLabel,
  SectionHeader,
  timeSince,
} from '../../components/console/ConsolePrimitives'
import { CreateOrganizationForm } from '../../components/console/CreateOrganizationForm'
import { DEMO_SERVICES, isDemoMode } from '../../hooks/useDemoMode'
import {
  DEMO_ACTIVITY,
  DEMO_INCIDENTS,
  DEMO_PR_RISKS,
  type DemoActivityEvent,
  type DemoIncident,
  type DemoPRRisk,
  type DemoService,
  type EnvName,
} from '../../lib/demo-data'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENV_LABELS: Record<EnvName, string> = {
  production: 'Production',
  staging: 'Staging',
  preview: 'Preview',
}

const ENV_DOT: Record<EnvName, string> = {
  production: 'bg-signal-success',
  staging: 'bg-amber-400',
  preview: 'bg-ink-quaternary',
}

// ─── /overview entry point ────────────────────────────────────────────────────

export function OverviewRedirectOrPrompt() {
  const { orgId, projectId } = useParams({ strict: false })
  const navigate = useNavigate()

  if (!orgId) {
    return (
      <OrgSetupPrompt
        onOrgCreated={(org) => {
          navigate({ to: '/orgs/$orgId', params: { orgId: org.workosOrgId }, replace: true })
        }}
      />
    )
  }

  if (orgId && projectId) {
    return (
      <Navigate
        to="/orgs/$orgId/projects/$projectId/overview"
        params={{ orgId, projectId }}
        replace
      />
    )
  }

  // Org exists but no project selected — show placeholder
  return <NoProjectSelected orgId={orgId} />
}

// ─── /orgs/:orgId/projects/:projectId entry point ────────────────────────

export function ProjectPage() {
  const { orgId, projectId } = useParams({ strict: false })

  const [project] = useQuery(
    queries.projectById({
      id: projectId,
    }),
  )
  const [serviceList] = useQuery(queries.servicesForProject({ projectId: projectId ?? '__none__' }))

  if (!orgId || !projectId) {
    return <Navigate to="/500" replace />
  }

  if (project === undefined) {
    if (DEV_BYPASS_AUTH) {
      return <ProjectDetail orgId={orgId} projectId={projectId} services={[]} />
    }
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="font-mono text-[11px] tracking-wider text-ink-tertiary uppercase">
          Loading…
        </span>
      </div>
    )
  }

  if (!project) {
    return <Navigate to={'/orgs/$orgId'} params={{ orgId }} />
  }

  return (
    <ProjectDetail
      projectId={project.id}
      projectName={project.name}
      orgId={orgId ?? ''}
      services={serviceList}
    />
  )
}

// ─── Unified project detail ───────────────────────────────────────────────────

function ProjectDetail({
  projectId,
  projectName,
  orgId,
  services,
}: {
  projectId: string
  projectName?: string
  orgId: string
  services: Array<Service>
}) {
  const [serviceRows] = useQuery(queries.allServices({}))
  const demo = isDemoMode(serviceRows)

  const search = useSearch({ strict: false }) as Record<string, string>
  const activeEnv = (search['env'] ?? 'production') as EnvName
  const navigate = useNavigate()

  const demoServices = DEMO_SERVICES
  const displayServices = demo ? demoServices : services

  // Product zone data (demo-only)
  const activeCanaries = demoServices.filter((s) => s.deployments[0]?.status === 'canary')
  const incidents = demoServices.filter((s) => s.health === 'incident')
  const degraded = demoServices.filter((s) => s.health === 'degraded')
  const pendingPRs = DEMO_PR_RISKS.filter((p) => p.status === 'pending_deploy')
  const highRiskPRs = DEMO_PR_RISKS.filter(
    (p) => p.riskLevel === 'high' && p.status === 'pending_deploy',
  )
  const recentRollbacks = DEMO_INCIDENTS.slice(0, 3)

  // Stat counts (demo)
  const healthyCount = demoServices.filter((s) => s.health === 'healthy').length
  const degradedCount = demoServices.filter((s) => s.health === 'degraded').length
  const incidentCount = demoServices.filter((s) => s.health === 'incident').length
  const activeCanaryCount = demoServices.filter((s) =>
    s.deployments.some((d) => d.status === 'canary'),
  ).length

  return (
    <div className="min-h-full">
      {demo && <DemoBanner />}

      <div className="px-8 py-10 animate-fade-up">
        {/* Breadcrumb */}
        <Breadcrumb orgId={orgId} projectId={projectId} />

        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight text-ink mb-1"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
            >
              {projectName ?? projectId}
            </h1>
            <p
              className="text-[11px] text-ink-tertiary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {projectId}
            </p>
          </div>
          {demo && (
            <Link
              to="/orgs/$orgId/projects/$projectId/integrate"
              params={{ orgId, projectId }}
              className="shrink-0 flex items-center gap-1.5 rounded-[2px] border border-line px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              <Plus size={12} strokeWidth={2} />
              Add service
            </Link>
          )}
        </div>

        {/* Stat pills (demo) */}
        {demo && (
          <div className="mb-10 flex flex-wrap gap-2">
            <StatPill
              icon={<CheckCircle2 size={12} className="text-signal-success" />}
              label={`${healthyCount} healthy`}
            />
            {degradedCount > 0 && (
              <StatPill
                icon={<AlertTriangle size={12} className="text-amber-500" />}
                label={`${degradedCount} degraded`}
                variant="warn"
              />
            )}
            {incidentCount > 0 && (
              <StatPill
                icon={<AlertTriangle size={12} className="text-signal-danger" />}
                label={`${incidentCount} incident`}
                variant="error"
              />
            )}
            {activeCanaryCount > 0 && (
              <StatPill
                icon={<Zap size={12} className="text-ink-tertiary" />}
                label={`${activeCanaryCount} canary active`}
              />
            )}
            <StatPill
              icon={<Users size={12} className="text-ink-tertiary" />}
              label={`${demoServices.length} services`}
            />
          </div>
        )}

        {/* Alert strip — incidents take priority visually */}
        {demo && (incidents.length > 0 || degraded.length > 0) && (
          <div className="mb-8 space-y-2.5 animate-stagger">
            {incidents.map((svc) => (
              <AlertStrip
                key={svc.id}
                service={svc}
                type="incident"
                orgId={orgId}
                projectId={projectId}
              />
            ))}
            {degraded.map((svc) => (
              <AlertStrip
                key={svc.id}
                service={svc}
                type="degraded"
                orgId={orgId}
                projectId={projectId}
              />
            ))}
          </div>
        )}

        {/* ── Product zones (demo only) ── */}
        {demo && (
          <>
            <ProductZone
              icon={<Rocket size={13} strokeWidth={1.75} className="text-ink-tertiary" />}
              label="Rollouts"
              sublabel="Active canary deployments"
              to="/orgs/$orgId/projects/$projectId/rollouts"
              params={{ orgId, projectId }}
              linkLabel="View all rollouts"
              isEmpty={activeCanaries.length === 0}
              emptyMessage="No active rollouts. All services are at stable."
            >
              {activeCanaries.map((svc) => (
                <ActiveCanaryRow key={svc.id} service={svc} orgId={orgId} projectId={projectId} />
              ))}
            </ProductZone>

            <ProductZone
              icon={<Eye size={13} strokeWidth={1.75} className="text-ink-tertiary" />}
              label="Foresight"
              sublabel="Deployment risk signals"
              to="/orgs/$orgId/projects/$projectId/foresight"
              params={{ orgId, projectId }}
              linkLabel="View all signals"
              isEmpty={pendingPRs.length === 0}
              emptyMessage="No open risk signals."
            >
              {highRiskPRs.length > 0 && (
                <div className="space-y-2">
                  {highRiskPRs.slice(0, 3).map((pr) => (
                    <ForesightRow key={pr.id} pr={pr} orgId={orgId} projectId={projectId} />
                  ))}
                  {pendingPRs.length > highRiskPRs.length && (
                    <p
                      className="text-[10px] text-ink-quaternary px-1"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      +{pendingPRs.length - highRiskPRs.length} medium/low risk PRs pending
                    </p>
                  )}
                </div>
              )}
              {highRiskPRs.length === 0 && pendingPRs.length > 0 && (
                <div className="space-y-2">
                  {pendingPRs.slice(0, 3).map((pr) => (
                    <ForesightRow key={pr.id} pr={pr} orgId={orgId} projectId={projectId} />
                  ))}
                </div>
              )}
            </ProductZone>

            <ProductZone
              icon={<RotateCcw size={13} strokeWidth={1.75} className="text-ink-tertiary" />}
              label="Rollback"
              sublabel="Rollback activity"
              to="/orgs/$orgId/projects/$projectId/rollback"
              params={{ orgId, projectId }}
              linkLabel="View history"
              isEmpty={recentRollbacks.length === 0}
              emptyMessage="No rollbacks in the past 30 days."
            >
              {recentRollbacks.map((inc) => (
                <RollbackRow key={inc.id} incident={inc} orgId={orgId} projectId={projectId} />
              ))}
            </ProductZone>
          </>
        )}

        {/* Env tabs (demo) */}
        {demo && (
          <div className="flex items-center gap-0.5 border-b border-line mb-8 -mx-1 px-1">
            {(['production', 'staging', 'preview'] as EnvName[]).map((env) => (
              <button
                key={env}
                onClick={() => navigate({ to: '.', search: { env } })}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 text-[12px] border-b-2 -mb-px transition-colors focus:outline-none rounded-t-[2px]',
                  activeEnv === env
                    ? 'border-ink text-ink font-medium'
                    : 'border-transparent text-ink-tertiary hover:text-ink',
                ].join(' ')}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${ENV_DOT[env]}`} />
                {ENV_LABELS[env]}
              </button>
            ))}
          </div>
        )}

        {/* Services — cards (demo) or table (real) */}
        {demo ? (
          <ServicesGrid
            services={demoServices}
            env={activeEnv}
            orgId={orgId}
            projectId={projectId}
          />
        ) : (
          <section className="mt-2">
            <SectionHeader right={`${displayServices.length} services`}>Services</SectionHeader>
            {displayServices.length === 0 ? (
              <NoServicesEmptyState projectId={projectId} orgId={orgId} />
            ) : (
              <ul>
                {(
                  displayServices as Array<{
                    id: string
                    serviceName: string
                    routingStrategy?: string | null
                  }>
                ).map((svc, i) => (
                  <li key={svc.id}>
                    <Link
                      to="/orgs/$orgId/projects/$projectId/services/$serviceName"
                      params={{
                        orgId,
                        projectId,
                        serviceName: encodeURIComponent(svc.serviceName),
                      }}
                      className={[
                        'group flex items-center justify-between px-4 py-3.5 border border-line bg-surface',
                        'transition-colors hover:bg-surface-alt hover:border-primary/20',
                        'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
                        i === 0 ? 'rounded-t-[2px]' : '',
                        i === displayServices.length - 1 ? 'rounded-b-[2px]' : 'border-b-0',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Circle
                          size={6}
                          className="shrink-0 fill-signal-success text-signal-success"
                        />
                        <div className="min-w-0">
                          <p
                            className="text-[13px] font-medium text-ink leading-none mb-1 truncate"
                            style={{ fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            {svc.serviceName}
                          </p>
                          <p className="text-[10px] text-ink-tertiary leading-none">
                            {svc.routingStrategy ?? 'percentage'} routing
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        strokeWidth={1.75}
                        className="shrink-0 text-ink-quaternary transition-colors group-hover:text-ink-tertiary ml-4"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Bottom 2-col: activity + project sidebar (demo only) */}
        {demo && (
          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActivityFeed events={DEMO_ACTIVITY} orgId={orgId} projectId={projectId} />
            </div>
            <div>
              <ProjectSidebar services={demoServices} projectId={projectId} orgId={orgId} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Product zone wrapper ─────────────────────────────────────────────────────

function ProductZone({
  icon,
  label,
  sublabel,
  to,
  params,
  linkLabel,
  isEmpty,
  emptyMessage,
  children,
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  to: string
  params: Record<string, string>
  linkLabel: string
  isEmpty: boolean
  emptyMessage: string
  children?: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <span
            className="text-[13px] font-medium text-ink"
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          >
            {label}
          </span>
          <span
            className="text-[10px] text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {sublabel}
          </span>
        </div>
        <Link
          to={to}
          params={params}
          className="flex items-center gap-1 text-[10px] text-ink-tertiary hover:text-ink transition-colors duration-150"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {linkLabel}
          <ChevronRight size={10} strokeWidth={1.75} />
        </Link>
      </div>
      {isEmpty ? (
        <ZoneEmptyState message={emptyMessage} />
      ) : (
        <div className="space-y-2.5 animate-stagger">{children}</div>
      )}
    </section>
  )
}

function ZoneEmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-[4px] border border-dashed border-line">
      <CheckCircle size={11} strokeWidth={1.75} className="text-signal-success/60 shrink-0" />
      <span className="text-[11px] text-ink-quaternary">{message}</span>
    </div>
  )
}

// ─── Rollouts zone row ────────────────────────────────────────────────────────

function ActiveCanaryRow({
  service,
  orgId,
  projectId,
}: {
  service: DemoService
  orgId: string
  projectId: string
}) {
  const dep = service.deployments[0]
  if (!dep) return null
  const canaryPct = dep.canaryWeight

  return (
    <Link
      to="/orgs/$orgId/projects/$projectId/services/$serviceName"
      params={{ orgId, projectId, serviceName: encodeURIComponent(service.serviceName) }}
      className="flex items-center gap-4 px-4 py-3 rounded-[4px] border border-signal-deploy/25 bg-signal-deploy/5 hover:bg-signal-deploy/10 transition-colors duration-150"
    >
      <span className="relative shrink-0 flex items-center justify-center w-4 h-4">
        <span className="absolute w-3 h-3 rounded-full bg-signal-deploy/20 animate-pulse-dot" />
        <Activity size={11} strokeWidth={2} className="text-signal-deploy relative z-10" />
      </span>
      <span
        className="text-[12px] font-medium text-ink w-40 shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {service.serviceName}
      </span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden flex">
          <div
            className="h-full bg-signal-success transition-all duration-700 ease-out"
            style={{ width: `${dep.stableWeight}%` }}
          />
          <div
            className="h-full bg-signal-deploy transition-all duration-700 ease-out"
            style={{ width: `${canaryPct}%` }}
          />
        </div>
        <span
          className="text-[9px] text-ink-tertiary shrink-0 w-32"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {dep.stableWeight}% stable · {canaryPct}% canary
        </span>
      </div>
      <span
        className="text-[10px] text-ink-quaternary shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {dep.version}
      </span>
      <span
        className="text-[10px] text-ink-quaternary shrink-0 w-16 text-right"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
        title="Time since canary started"
      >
        {timeSince(dep.startedAt ?? service.lastDeployedAt)}
      </span>
      <ChevronRight size={12} strokeWidth={1.75} className="text-ink-quaternary shrink-0" />
    </Link>
  )
}

// ─── Foresight zone row ───────────────────────────────────────────────────────

function ForesightRow({
  pr,
  orgId,
  projectId,
}: {
  pr: DemoPRRisk
  orgId: string
  projectId: string
}) {
  const isHighRisk = pr.riskLevel === 'high'
  const borderColor =
    pr.riskLevel === 'high'
      ? 'border-signal-danger/30'
      : pr.riskLevel === 'medium'
        ? 'border-signal-warning/20'
        : 'border-line'
  const bgColor =
    pr.riskLevel === 'high'
      ? 'bg-signal-danger/5 hover:bg-signal-danger/8'
      : pr.riskLevel === 'medium'
        ? 'bg-signal-warning/4 hover:bg-signal-warning/6'
        : 'bg-surface hover:bg-surface-alt'
  const riskColor =
    pr.riskLevel === 'high'
      ? 'text-signal-danger'
      : pr.riskLevel === 'medium'
        ? 'text-signal-warning'
        : 'text-signal-success'

  return (
    <Link
      to="/orgs/$orgId/projects/$projectId/foresight"
      params={{ orgId, projectId }}
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-[4px] border transition-colors duration-150',
        borderColor,
        bgColor,
      ].join(' ')}
    >
      <span
        className={[
          'text-[13px] font-semibold w-8 shrink-0 text-center tabular-nums',
          riskColor,
          isHighRisk ? 'opacity-100' : 'opacity-80',
        ].join(' ')}
        style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em' }}
      >
        {pr.riskScore}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className={[
            'text-[11px] font-medium truncate block',
            isHighRisk ? 'text-ink' : 'text-ink-secondary',
          ].join(' ')}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          #{pr.prNumber} — {pr.prTitle}
        </span>
        <span
          className="text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {pr.service} · {pr.blastRadiusCount} service{pr.blastRadiusCount !== 1 ? 's' : ''}{' '}
          affected
        </span>
      </div>
      <ChevronRight size={12} strokeWidth={1.75} className="text-ink-quaternary shrink-0" />
    </Link>
  )
}

// ─── Rollback zone row ────────────────────────────────────────────────────────

function RollbackRow({
  incident,
  orgId,
  projectId,
}: {
  incident: DemoIncident
  orgId: string
  projectId: string
}) {
  return (
    <Link
      to="/orgs/$orgId/projects/$projectId/rollback"
      params={{ orgId, projectId }}
      className="flex items-center gap-3 px-4 py-3 rounded-[4px] border border-signal-danger/20 bg-signal-danger/4 hover:bg-signal-danger/7 transition-colors duration-150"
    >
      <RotateCcw size={12} strokeWidth={2} className="text-signal-danger shrink-0" />
      <span
        className="text-[11px] font-medium text-ink w-40 shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {incident.service}
      </span>
      <span
        className="text-[10px] text-ink-tertiary shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {incident.version}
      </span>
      <span className="text-[10px] text-ink-tertiary flex-1">
        error rate {incident.errorRateAtTrigger.toFixed(1)}% at trigger
      </span>
      {incident.recoveryMs && (
        <span
          className="text-[10px] text-signal-success shrink-0"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          recovered in {(incident.recoveryMs / 1000).toFixed(1)}s
        </span>
      )}
      <span
        className="text-[9px] text-ink-quaternary shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {timeSince(incident.triggeredAt)}
      </span>
      <ChevronRight size={12} strokeWidth={1.75} className="text-ink-quaternary shrink-0" />
    </Link>
  )
}

// ─── Alert strip ──────────────────────────────────────────────────────────────

function AlertStrip({
  service,
  type,
  orgId,
  projectId,
}: {
  service: DemoService
  type: 'incident' | 'degraded'
  orgId: string
  projectId: string
}) {
  const isIncident = type === 'incident'
  return (
    <Link
      to="/orgs/$orgId/projects/$projectId/services/$serviceName"
      params={{ orgId, projectId, serviceName: encodeURIComponent(service.serviceName) }}
      className={[
        'flex items-center gap-3 px-4 py-2.5 rounded-[4px] border transition-colors duration-150 hover:opacity-90',
        isIncident
          ? 'bg-signal-danger/8 border-signal-danger/25'
          : 'bg-signal-warning/8 border-signal-warning/25',
      ].join(' ')}
    >
      <AlertTriangle
        size={13}
        strokeWidth={2}
        className={isIncident ? 'text-signal-danger shrink-0' : 'text-signal-warning shrink-0'}
      />
      <span
        className="text-[11px] font-medium text-ink"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {service.serviceName}
      </span>
      <span className="text-[11px] text-ink-tertiary">
        {isIncident
          ? `Incident — error rate ${service.errorRate.toFixed(1)}%`
          : `Degraded — error rate ${service.errorRate.toFixed(2)}%, p99 ${service.p99Latency}ms`}
      </span>
      <ChevronRight size={12} strokeWidth={1.75} className="ml-auto text-ink-quaternary shrink-0" />
    </Link>
  )
}

// ─── Services grid (demo) ─────────────────────────────────────────────────────

function ServicesGrid({
  services,
  env,
  orgId,
  projectId,
}: {
  services: DemoService[]
  env: EnvName
  orgId: string
  projectId: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((svc) => (
        <ServiceCard key={svc.id} service={svc} env={env} orgId={orgId} projectId={projectId} />
      ))}
    </div>
  )
}

function ServiceCard({
  service,
  env,
  orgId,
  projectId,
}: {
  service: DemoService
  env: EnvName
  orgId: string
  projectId: string
}) {
  const envData = service.envs.find((e) => e.env === env) ?? service.envs[0]
  const activeDeployment = service.deployments.find(
    (d) => d.status === 'canary' || d.status === 'deploying',
  )
  const isCanaryActive = !!activeDeployment && env === 'production'

  return (
    <Link
      to="/orgs/$orgId/projects/$projectId/services/$serviceName"
      params={{ orgId, projectId, serviceName: encodeURIComponent(service.serviceName) }}
      className="group flex flex-col rounded-[2px] border border-line bg-surface p-4 transition-colors hover:border-primary/30 hover:bg-surface-alt focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <HealthDot health={envData?.health ?? service.health} />
            <span
              className="text-[13px] font-medium text-ink truncate"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {service.serviceName}
            </span>
          </div>
          <p className="text-[10px] text-ink-quaternary truncate">{service.description}</p>
        </div>
        {isCanaryActive && (
          <span className="shrink-0 flex items-center gap-1 rounded-[2px] bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400">
            <Zap size={9} />
            Canary
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <MetricMini
          label="err"
          value={`${envData?.errorRate?.toFixed(2) ?? '—'}%`}
          danger={(envData?.errorRate ?? 0) > 0.5}
        />
        <MetricMini
          label="p99"
          value={`${envData?.p99Latency ?? '—'}ms`}
          danger={(envData?.p99Latency ?? 0) > 300}
        />
        <MetricMini label="rpm" value={(envData?.requestsPerMin ?? 0).toLocaleString()} />
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span
          className="text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {envData?.activeVersion ?? service.activeVersion}
        </span>
        <span className="text-[10px] text-ink-quaternary">
          {timeSince(envData?.lastDeployedAt ?? service.lastDeployedAt)}
        </span>
      </div>
      {isCanaryActive && activeDeployment && (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="flex justify-between mb-1">
            <span className="text-[9px] text-ink-quaternary uppercase tracking-wider">
              Canary traffic
            </span>
            <span
              className="text-[9px] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {activeDeployment.canaryWeight}%
            </span>
          </div>
          <div className="flex h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${activeDeployment.canaryWeight}%` }}
            />
            <div className="h-full flex-1 bg-signal-success/30" />
          </div>
        </div>
      )}
    </Link>
  )
}

function MetricMini({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className="text-[9px] uppercase tracking-wider text-ink-quaternary"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </span>
      <span
        className={`text-[11px] font-medium ${danger ? 'text-signal-danger' : 'text-ink'}`}
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<DemoActivityEvent['type'], React.ElementType> = {
  deploy: Zap,
  rollback: RotateCcw,
  incident: AlertTriangle,
  pr_analyzed: GitPullRequest,
  config_change: Settings2,
  member_joined: Users,
  integration_added: Wrench,
}

const ACTIVITY_SEVERITY_DOT: Record<DemoActivityEvent['severity'], string> = {
  info: 'bg-ink-quaternary',
  warn: 'bg-amber-400',
  error: 'bg-signal-danger',
}

function ActivityFeed({
  events,
  orgId,
  projectId,
}: {
  events: DemoActivityEvent[]
  orgId: string
  projectId: string
}) {
  const [limit, setLimit] = useState(8)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-[11px] font-semibold text-ink uppercase tracking-[0.08em]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Activity
        </h2>
        <span className="text-[10px] text-ink-quaternary">{events.length} events</span>
      </div>
      <ol className="relative border-l border-line ml-3 space-y-0">
        {events.slice(0, limit).map((ev) => {
          const Icon = ACTIVITY_ICON[ev.type]
          return (
            <li key={ev.id} className="relative pl-6 pb-5 last:pb-0">
              <span
                className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface ${ACTIVITY_SEVERITY_DOT[ev.severity]}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={11} strokeWidth={1.75} className="shrink-0 text-ink-tertiary" />
                    <span className="text-[12px] font-medium text-ink">{ev.title}</span>
                    {ev.service && (
                      <Link
                        to="/orgs/$orgId/projects/$projectId/services/$serviceName"
                        params={{
                          orgId,
                          projectId,
                          serviceName: encodeURIComponent(ev.service),
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-ink-quaternary hover:text-ink transition-colors"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {ev.service}
                      </Link>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-tertiary leading-relaxed">{ev.detail}</p>
                  <p className="mt-0.5 text-[10px] text-ink-quaternary">
                    {ev.actor} · {formatTs(ev.ts)}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {limit < events.length && (
        <button
          onClick={() => setLimit((l) => l + 8)}
          className="mt-4 ml-3 text-[11px] text-ink-tertiary hover:text-ink transition-colors focus:outline-none"
        >
          Show more ({events.length - limit} remaining)
        </button>
      )}
    </section>
  )
}

// ─── Project sidebar ──────────────────────────────────────────────────────────

function ProjectSidebar({
  services,
  projectId,
  orgId,
}: {
  services: DemoService[]
  projectId: string
  orgId: string
}) {
  const teams = [...new Set(services.map((s) => s.team))].sort()
  const unintegrated = services.filter((s) => !s.integrated)

  return (
    <div className="space-y-8">
      <section>
        <h3
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary mb-3"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Teams
        </h3>
        <ul className="space-y-1">
          {teams.map((team) => {
            const count = services.filter((s) => s.team === team).length
            return (
              <li key={team} className="flex items-center justify-between py-1">
                <span className="text-[12px] text-ink">{team}</span>
                <span className="text-[10px] text-ink-quaternary">{count} svc</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary mb-3"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Runtimes
        </h3>
        <ul className="space-y-1">
          {[...new Set(services.map((s) => s.runtime))].map((rt) => (
            <li key={rt} className="text-[12px] text-ink-tertiary">
              {rt}
            </li>
          ))}
        </ul>
      </section>

      {unintegrated.length > 0 && (
        <section>
          <h3
            className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400 mb-3"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            Not integrated
          </h3>
          <ul className="space-y-1.5">
            {unintegrated.map((svc) => (
              <li key={svc.id} className="flex items-center justify-between">
                <span
                  className="text-[11px] text-ink-tertiary"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {svc.serviceName}
                </span>
                <Link
                  to="/orgs/$orgId/projects/$projectId/integrate"
                  params={{ orgId, projectId }}
                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline focus:outline-none"
                >
                  Integrate →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary mb-3"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Quick links
        </h3>
        <ul className="space-y-1.5">
          {[
            { label: 'Deployments', to: '/deployments' },
            { label: 'Foresight', to: '/foresight' },
            { label: 'Billing', to: '/billing' },
            { label: 'Settings', to: '/settings' },
          ].map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="flex items-center gap-1 text-[12px] text-ink-tertiary hover:text-ink transition-colors"
              >
                <ChevronRight size={10} />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ orgId, projectId }: { orgId: string; projectId: string }) {
  const [orgDetails] = useQuery(
    queries.orgById({
      workosOrgId: orgId,
    }),
  )
  const [projectDetails] = useQuery(
    queries.projectById({
      id: projectId,
    }),
  )
  return (
    <nav className="flex items-center gap-1.5 mb-6" aria-label="Breadcrumb">
      <Link
        to="/orgs/$orgId"
        params={{ orgId }}
        className="text-[11px] text-ink-tertiary hover:text-ink transition-colors"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {orgDetails?.name}
      </Link>
      <ChevronRight size={10} strokeWidth={1.75} className="text-ink-quaternary" />
      <span className="text-[11px] text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {projectDetails?.name}
      </span>
    </nav>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  variant?: 'default' | 'warn' | 'error'
}) {
  const bg =
    variant === 'warn'
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-400/10 dark:border-amber-400/20'
      : variant === 'error'
        ? 'bg-signal-danger/5 border-signal-danger/20'
        : 'bg-surface border-line'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-[11px] text-ink ${bg}`}
    >
      {icon}
      {label}
    </span>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function NoServicesEmptyState({ projectId, orgId }: { projectId: string; orgId: string }) {
  return (
    <div className="rounded-[2px] border border-dashed border-line px-6 py-10 text-center">
      <p className="text-[13px] font-medium text-ink mb-2">No services connected.</p>
      <p className="text-[11px] text-ink-tertiary max-w-sm mx-auto leading-relaxed mb-4">
        Use the integration wizard to connect your first service — it will open a PR with the
        DeployTitan config files into your repo.
      </p>
      <Link
        to="/orgs/$orgId/projects/$projectId/integrate"
        params={{ orgId, projectId }}
        className="inline-flex items-center gap-1.5 rounded-[2px] bg-ink px-3.5 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        <Wrench size={11} />
        Integration wizard
      </Link>
    </div>
  )
}

function NoProjectSelected({ orgId }: { orgId: string | null }) {
  return (
    <div className="px-8 py-16 max-w-xl">
      <h1
        className="text-[22px] font-medium tracking-tight text-ink leading-none mb-2"
        style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
      >
        Overview
      </h1>
      <p className="text-[12px] text-ink-tertiary mb-6">
        Select a project from the sidebar to see its overview.
      </p>
      {orgId && (
        <Link
          to="/orgs/$orgId"
          params={{ orgId }}
          className="inline-flex items-center gap-1 text-[12px] text-ink-tertiary hover:text-ink transition-colors"
        >
          <ChevronRight size={12} />
          Go to organization
        </Link>
      )}
    </div>
  )
}

// ─── Org setup prompt ─────────────────────────────────────────────────────────

interface OrgSetupPromptProps {
  onOrgCreated: (org: { workosOrgId: string; name: string }) => void
}

function OrgSetupPrompt({ onOrgCreated }: OrgSetupPromptProps) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-8 py-16 relative">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.55 0.09 85 / 0.035) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.55 0.09 85 / 0.035) 1px, transparent 1px),
            linear-gradient(oklch(0.55 0.09 85 / 0.014) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.55 0.09 85 / 0.014) 1px, transparent 1px)
          `,
          backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
        }}
      />
      <div className="relative z-10 w-full max-w-[400px] space-y-8 animate-fade-up">
        <SetupStepLabel />
        <CreateOrganizationForm compact onSuccess={onOrgCreated} />
      </div>
    </div>
  )
}

function SetupStepLabel() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <StepDot active />
        <StepLine />
        <StepDot />
        <StepLine />
        <StepDot />
      </div>
      <span
        className="text-[11px] text-ink-quaternary tracking-widest uppercase"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        Step 1 of 3
      </span>
    </div>
  )
}

function StepDot({ active }: { active?: boolean }) {
  return (
    <div
      className={[
        'w-1.5 h-1.5 rounded-full transition-colors duration-200',
        active ? 'bg-gold' : 'bg-line',
      ].join(' ')}
    />
  )
}

function StepLine() {
  return <div className="w-6 h-px bg-line" />
}

// suppress unused import warnings
void [Clock, RefreshCw, DeployStatusBadge, MonoLabel, SectionHeader, GitBranch]
