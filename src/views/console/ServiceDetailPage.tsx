'use client'

/**
 * ServiceDetailPage — rich service detail.
 * Route: /services/:serviceName
 *
 * Tabs:
 *   Overview  — live metrics, active rollout panel, SLO bars, Foresight risk
 *   Deployments — full deployment timeline with gates
 *   Environments — per-env health + config keys
 *   Logs      — stub log viewer
 *   Config    — env vars (redacted)
 */

import { useEffect, useState, useRef } from 'react'
import { useParams, Link, Navigate, useSearch, useNavigate } from '@/lib/navigation'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'
import {
  ChevronRight,
  GitBranch,
  GitCommit,
  GitPullRequest,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  Terminal,
  Settings2,
  Activity,
  Globe,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCheck,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import {
  HealthDot,
  DeployStatusBadge,
  RiskBadge,
  SloBar,
  timeSince,
  formatTs,
} from '../../components/console/ConsolePrimitives'
import {
  DEMO_SERVICES,
  type DemoService,
  type DemoDeployment,
  type EnvName,
} from '../../lib/demo-data'
import { DEV_BYPASS_AUTH } from '../../env'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'deployments' | 'environments' | 'logs' | 'config'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',      label: 'Overview',      icon: Activity    },
  { id: 'deployments',   label: 'Deployments',   icon: Zap         },
  { id: 'environments',  label: 'Environments',  icon: Globe       },
  { id: 'logs',          label: 'Logs',          icon: Terminal    },
  { id: 'config',        label: 'Config',        icon: Settings2   },
]

// ─── Root ──────────────────────────────────────────────────────────────────

export function ServiceDetailPage() {
  const { serviceName, orgId, projectId } = useParams({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/services/$serviceName' })

  const decoded = decodeURIComponent(serviceName ?? '')

  // Run Zero query — but only when we have a real projectId.
  // When projectId is null/empty, Zero would query with projectId='' which
  // either hangs (no sync server) or returns nothing. We pass a dummy
  // condition that will always return nothing so the query settles instantly.
  const [service] = useQuery(
    queries.serviceByProjectAndName({
      projectId: projectId ?? '__no_project__',
      serviceName: decoded,
    }),
  )

  // No projectId — skip Zero entirely, use demo data.
  if (!projectId) {
    const demo = DEMO_SERVICES.find((s) => s.serviceName === decoded) ?? DEMO_SERVICES[0]
    if (!demo) return <Navigate to="/onboarding/create-org" />
    return <DemoServiceDetail service={demo} orgSlug={orgId} projectSlug={projectId} />
  }

  // Zero is running a real query — wait for it to resolve.
  // In dev-bypass mode (no real Zero server), fall through to demo immediately.
  if (service === undefined) {
    if (DEV_BYPASS_AUTH) {
      const demo = DEMO_SERVICES.find((s) => s.serviceName === decoded) ?? DEMO_SERVICES[0]
      if (!demo) return <Navigate to="/onboarding/create-org" />
      return <DemoServiceDetail service={demo} orgSlug={orgId} projectSlug={projectId} />
    }
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="font-mono text-[11px] tracking-wider text-ink-tertiary uppercase">Loading…</span>
      </div>
    )
  }

  // Real data found
  if (service) {
    return (
      <RealServiceDetail
        service={service as { id: string; serviceName: string; routingStrategy?: string | null }}
        orgSlug={orgId}
        projectSlug={projectId}
      />
    )
  }

  // Zero resolved with no result — fall through to demo
  const demo = DEMO_SERVICES.find((s) => s.serviceName === decoded) ?? DEMO_SERVICES[0]
  if (!demo) return <Navigate to="/onboarding/create-org" />
  return <DemoServiceDetail service={demo} orgSlug={orgId} projectSlug={projectId} />
}

// ─── Real service detail ──────────────────────────────────────────────────

function RealServiceDetail({
  service,
  orgSlug,
  projectSlug,
}: {
  service: { id: string; serviceName: string; routingStrategy?: string | null }
  orgSlug: string
  projectSlug: string
}) {
  return (
    <div className="px-8 py-10">
      <ServiceBreadcrumb orgSlug={orgSlug} projectSlug={projectSlug} serviceName={service.serviceName} />
      <h1 className="text-2xl font-semibold tracking-tight text-ink mb-8" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {service.serviceName}
      </h1>
      <p className="text-[12px] text-ink-tertiary">
        Connect your service via the CLI to see live deployment data here.
      </p>
      <pre className="mt-4 rounded-[2px] border border-line bg-surface-alt px-4 py-3 text-[11px] text-ink-secondary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        dt connect --service {service.serviceName}
      </pre>
    </div>
  )
}

// ─── Demo service detail ──────────────────────────────────────────────────

function DemoServiceDetail({
  service,
  orgSlug,
  projectSlug,
}: {
  service: DemoService
  orgSlug: string
  projectSlug: string
}) {
  const search = useSearch({ strict: false }) as Record<string, string>
  const activeTab = search['tab'] ?? 'overview'
  const navigate = useNavigate()

  const activeDeployment = service.deployments.find(
    (d) => d.status === 'canary' || d.status === 'deploying',
  )

  return (
    <div className="px-8 py-10">
      <ServiceBreadcrumb orgSlug={orgSlug} projectSlug={projectSlug} serviceName={service.serviceName} />

      {/* Service header */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <HealthDot health={service.health} />
            <h1 className="text-2xl font-semibold tracking-tight text-ink" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.01em' }}>
              {service.serviceName}
            </h1>
          </div>
          <p className="text-[12px] text-ink-tertiary mb-1">{service.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <Meta icon={<GitBranch size={11} />} label={service.runtime} />
            <Meta icon={<GitCommit size={11} />} label={`${service.team}`} />
            <a
              href={service.repoUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-ink-quaternary hover:text-ink transition-colors"
            >
              <ExternalLink size={11} />
              {service.repoUrl.replace('https://github.com/', '')}
            </a>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[11px] text-ink-tertiary capitalize">{service.routingStrategy}</span>
          <DeployStatusBadge status={activeDeployment?.status ?? 'completed'} />
        </div>
      </div>

      {/* Top-level metrics strip */}
      <MetricsStrip service={service} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => navigate({ to: '.', search: { tab: v } })} className="mt-6">
        <TabsList variant="line" className="border-b border-line mb-8 w-full justify-start -mx-1 px-1 rounded-none">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] rounded-t-[2px]">
                <Icon size={13} />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview"><OverviewTab service={service} activeDeployment={activeDeployment ?? null} /></TabsContent>
        <TabsContent value="deployments"><DeploymentsTab deployments={service.deployments} /></TabsContent>
        <TabsContent value="environments"><EnvironmentsTab service={service} /></TabsContent>
        <TabsContent value="logs"><LogsTab serviceName={service.serviceName} /></TabsContent>
        <TabsContent value="config"><ConfigTab service={service} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Metrics strip ─────────────────────────────────────────────────────────

function MetricsStrip({ service }: { service: DemoService }) {
  const items = [
    { label: 'Error rate', value: `${service.errorRate.toFixed(2)}%`, danger: service.errorRate > 0.5 },
    { label: 'p99 latency', value: `${service.p99Latency}ms`, danger: service.p99Latency > 300 },
    { label: 'Req/min', value: service.requestsPerMin.toLocaleString(), danger: false },
    { label: 'Stable', value: service.stableVersion, danger: false },
    { label: 'Active', value: service.activeVersion, danger: false },
    { label: 'Last deploy', value: timeSince(service.lastDeployedAt), danger: false },
  ]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-0 rounded-[2px] border border-line overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={[
            'px-3 py-3 bg-surface',
            i > 0 ? 'border-l border-line' : '',
          ].join(' ')}
        >
          <p className="text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {item.label}
          </p>
          <p className={`text-[13px] font-medium ${item.danger ? 'text-signal-danger' : 'text-ink'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Overview ─────────────────────────────────────────────────────────

function OverviewTab({
  service,
  activeDeployment,
}: {
  service: DemoService
  activeDeployment: DemoDeployment | null
}) {
  return (
    <div className="space-y-8">
      {/* Active rollout / idle state */}
      {activeDeployment ? (
        <LiveRolloutPanel service={service} deployment={activeDeployment} />
      ) : (
        <IdlePanel service={service} />
      )}

      {/* Foresight row for latest deployment */}
      {service.deployments[0] && (
        <ForesightPanel deployment={service.deployments[0]} />
      )}

      {/* Phoenix events */}
      <PhoenixPanel service={service} />
    </div>
  )
}

// ─── Live rollout panel ────────────────────────────────────────────────────

function LiveRolloutPanel({
  service,
  deployment,
}: {
  service: DemoService
  deployment: DemoDeployment
}) {
  // Simulated live metric drift
  const [errRate, setErrRate] = useState(deployment.errorRate)
  const [p99, setP99] = useState(deployment.p99Latency)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setErrRate((v) => Math.max(0, Math.min(deployment.errorRateThreshold * 1.5, v + (Math.random() - 0.48) * 0.03)))
      setP99((v) => Math.max(30, Math.min(deployment.p99Threshold * 1.2, v + (Math.random() - 0.48) * 8)))
    }, 3000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [deployment.errorRateThreshold, deployment.p99Threshold])

  const errPct = Math.min(1, errRate / deployment.errorRateThreshold)
  const p99Pct = Math.min(1, p99 / deployment.p99Threshold)

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
        <h2 className="text-[11px] font-semibold text-ink uppercase tracking-[0.08em]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          Live Rollout — {deployment.version}
        </h2>
      </div>

      <div className="rounded-[2px] border border-amber-200/60 bg-amber-50/30 dark:border-amber-400/20 dark:bg-amber-400/5 p-5 space-y-5">
        {/* Traffic split */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Traffic split</span>
            <span className="text-[10px] text-ink-quaternary">{deployment.strategy}</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${deployment.canaryWeight}%` }} />
            <div className="h-full flex-1 bg-signal-success/40" />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-amber-600 dark:text-amber-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{deployment.canaryWeight}% canary ({deployment.version})</span>
            <span className="text-[10px] text-signal-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{deployment.stableWeight}% stable ({service.stableVersion})</span>
          </div>
        </div>

        {/* SLO gates */}
        <div className="space-y-3">
          <SloBar label="Error rate" value={errRate} threshold={deployment.errorRateThreshold} unit="%" higherIsBad />
          <SloBar label="p99 latency" value={p99} threshold={deployment.p99Threshold} unit="ms" higherIsBad />
        </div>

        {/* Promotion gates table */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Promotion gates</p>
          <div className="space-y-1">
            {deployment.gates.map((gate) => (
              <div key={gate.name} className="flex items-center justify-between py-1 border-b border-line/50 last:border-0">
                <div className="flex items-center gap-2">
                  <GateIcon status={gate.status} />
                  <span className="text-[12px] text-ink">{gate.name}</span>
                </div>
                <span className="text-[11px] text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{gate.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PR info */}
        <div className="pt-2 border-t border-line/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest size={12} className="text-ink-tertiary" />
            <span className="text-[11px] text-ink">PR #{deployment.prNumber}</span>
            <span className="text-[11px] text-ink-tertiary truncate max-w-xs">{deployment.prTitle}</span>
          </div>
          <RiskBadge level={deployment.prRiskLevel} score={deployment.prRiskScore} />
        </div>
      </div>
    </section>
  )
}

// ─── Idle panel ────────────────────────────────────────────────────────────

function IdlePanel({ service }: { service: DemoService }) {
  const last = service.deployments[0]
  return (
    <section>
      <h2 className="text-[11px] font-semibold text-ink uppercase tracking-[0.08em] mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        Current state
      </h2>
      <div className="rounded-[2px] border border-line bg-surface p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Traffic</span>
          </div>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-signal-success/30">
            <div className="h-full w-full bg-signal-success/60" />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-signal-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>100% stable ({service.stableVersion})</span>
          </div>
        </div>
        <div className="space-y-3">
          <SloBar label="Error rate" value={service.errorRate} threshold={last?.errorRateThreshold ?? 0.5} unit="%" higherIsBad />
          <SloBar label="p99 latency" value={service.p99Latency} threshold={last?.p99Threshold ?? 300} unit="ms" higherIsBad />
        </div>
      </div>
    </section>
  )
}

// ─── Foresight panel ───────────────────────────────────────────────────────

function ForesightPanel({ deployment }: { deployment: DemoDeployment }) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold text-ink uppercase tracking-[0.08em] mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        Titan Foresight — latest PR
      </h2>
      <div className="rounded-[2px] border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GitPullRequest size={13} className="shrink-0 text-ink-tertiary" />
              <span className="text-[13px] font-medium text-ink">PR #{deployment.prNumber}</span>
              <span className="text-[11px] text-ink-tertiary truncate">{deployment.prTitle}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-ink-quaternary">
              <GitBranch size={10} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{deployment.branch}</span>
              <span>·</span>
              <GitCommit size={10} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{deployment.commitSha}</span>
              <span>·</span>
              <span>{deployment.prAuthor}</span>
            </div>
          </div>
          <RiskBadge level={deployment.prRiskLevel} score={deployment.prRiskScore} />
        </div>
      </div>
    </section>
  )
}

// ─── Phoenix panel ─────────────────────────────────────────────────────────

function PhoenixPanel({ service }: { service: DemoService }) {
  const rollbacks = service.deployments.filter((d) => d.rollbackEvent)
  if (rollbacks.length === 0) return null

  return (
    <section>
      <h2 className="text-[11px] font-semibold text-ink uppercase tracking-[0.08em] mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        Titan Phoenix — rollback history
      </h2>
      <div className="space-y-2">
        {rollbacks.map((dep) => (
          <div key={dep.id} className="rounded-[2px] border border-signal-danger/20 bg-signal-danger/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw size={12} className="text-signal-danger" />
                  <span className="text-[12px] font-medium text-ink">{dep.version} rolled back</span>
                  <DeployStatusBadge status="rolled_back" />
                </div>
                <p className="text-[11px] text-ink-tertiary">
                  {dep.rollbackEvent!.triggeredBy === 'slo_breach' ? 'SLO breach' : 'Manual'} trigger ·
                  {' '}{dep.rollbackEvent!.scope} scope ·
                  {' '}recovered in {(dep.rollbackEvent!.recoveryMs / 1000).toFixed(1)}s
                </p>
                <p className="text-[10px] text-ink-quaternary mt-0.5">
                  {formatTs(dep.rollbackEvent!.triggeredAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-signal-danger font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dep.errorRate.toFixed(1)}% err</p>
                <p className="text-[11px] text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dep.p99Latency}ms p99</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Tab: Deployments ─────────────────────────────────────────────────────

function DeploymentsTab({ deployments }: { deployments: DemoDeployment[] }) {
  const [expanded, setExpanded] = useState<string | null>(deployments[0]?.id ?? null)

  return (
    <div className="space-y-3">
      {deployments.map((dep) => (
        <DeploymentRow
          key={dep.id}
          deployment={dep}
          isExpanded={expanded === dep.id}
          onToggle={() => setExpanded((v) => (v === dep.id ? null : dep.id))}
        />
      ))}
    </div>
  )
}

function DeploymentRow({
  deployment: dep,
  isExpanded,
  onToggle,
}: {
  deployment: DemoDeployment
  isExpanded: boolean
  onToggle: () => void
}) {
  const durationStr = dep.durationSecs
    ? dep.durationSecs >= 3600
      ? `${Math.round(dep.durationSecs / 3600)}h ${Math.round((dep.durationSecs % 3600) / 60)}m`
      : dep.durationSecs >= 60
      ? `${Math.round(dep.durationSecs / 60)}m`
      : `${dep.durationSecs}s`
    : 'In progress'

  return (
    <div className="rounded-[2px] border border-line overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 bg-surface hover:bg-surface-alt transition-colors text-left focus:outline-none"
      >
        {/* version + status */}
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <span className="text-[13px] font-medium text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dep.version}</span>
          <DeployStatusBadge status={dep.status} />
          <RiskBadge level={dep.prRiskLevel} score={dep.prRiskScore} />
        </div>

        {/* PR + author */}
        <div className="hidden sm:flex items-center gap-1.5 min-w-0 shrink">
          <GitPullRequest size={11} className="text-ink-quaternary shrink-0" />
          <span className="text-[11px] text-ink-tertiary truncate max-w-48">#{dep.prNumber} {dep.prTitle}</span>
        </div>

        {/* Duration + time */}
        <div className="shrink-0 flex items-center gap-4 text-[11px] text-ink-quaternary">
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{durationStr}</span>
          <span>{dep.completedAt ? timeSince(dep.completedAt) : timeSince(dep.startedAt)}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-line bg-surface-alt px-4 py-4 space-y-4">
          {/* Commit / branch row */}
          <div className="flex flex-wrap gap-4 text-[11px] text-ink-tertiary">
            <span className="flex items-center gap-1.5">
              <GitBranch size={11} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dep.branch}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <GitCommit size={11} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dep.commitSha}</span>
            </span>
            <span className="flex items-center gap-1.5">
              by <span className="font-medium text-ink ml-1">{dep.prAuthor}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {formatTs(dep.startedAt)}
              {dep.completedAt && <> → {formatTs(dep.completedAt)}</>}
            </span>
          </div>

          {/* Gates */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Promotion gates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {dep.gates.map((gate) => (
                <div key={gate.name} className="flex items-center justify-between py-1 border-b border-line/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <GateIcon status={gate.status} />
                    <span className="text-[12px] text-ink">{gate.name}</span>
                  </div>
                  <span className="text-[11px] text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{gate.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics at deploy time */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Error rate', value: `${dep.errorRate.toFixed(2)}%`, threshold: `< ${dep.errorRateThreshold}%`, ok: dep.errorRate < dep.errorRateThreshold },
              { label: 'p99 latency', value: `${dep.p99Latency}ms`, threshold: `< ${dep.p99Threshold}ms`, ok: dep.p99Latency < dep.p99Threshold },
              { label: 'Strategy', value: dep.strategy, threshold: '', ok: true },
            ].map((m) => (
              <div key={m.label} className="rounded-[2px] border border-line bg-surface px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-ink-quaternary mb-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{m.label}</p>
                <p className={`text-[13px] font-medium ${!m.ok ? 'text-signal-danger' : 'text-ink'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{m.value}</p>
                {m.threshold && <p className="text-[10px] text-ink-quaternary">{m.threshold}</p>}
              </div>
            ))}
          </div>

          {/* Rollback event */}
          {dep.rollbackEvent && (
            <div className="rounded-[2px] border border-signal-danger/30 bg-signal-danger/5 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw size={12} className="text-signal-danger" />
                <span className="text-[12px] font-medium text-signal-danger">Phoenix auto-rollback triggered</span>
              </div>
              <p className="text-[11px] text-ink-tertiary">
                Scope: <strong className="text-ink">{dep.rollbackEvent.scope}</strong> ·
                Trigger: <strong className="text-ink">{dep.rollbackEvent.triggeredBy}</strong> ·
                Recovery: <strong className="text-ink">{(dep.rollbackEvent.recoveryMs / 1000).toFixed(1)}s</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Environments ─────────────────────────────────────────────────────

const ENV_LABEL: Record<EnvName, string> = { production: 'Production', staging: 'Staging', preview: 'Preview' }
const ENV_DOT_COLOR: Record<EnvName, string> = { production: 'bg-signal-success', staging: 'bg-amber-400', preview: 'bg-ink-quaternary' }

function EnvironmentsTab({ service }: { service: DemoService }) {
  return (
    <div className="space-y-4">
      {service.envs.map((env) => (
        <div key={env.env} className="rounded-[2px] border border-line overflow-hidden">
          {/* Env header */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b border-line">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${ENV_DOT_COLOR[env.env]}`} />
              <span className="text-[12px] font-semibold text-ink">{ENV_LABEL[env.env]}</span>
              <HealthDot health={env.health} />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-ink-quaternary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              <span>{env.replicas} replica{env.replicas !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>last deploy {timeSince(env.lastDeployedAt)}</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-line">
            {[
              { label: 'Active',     value: env.activeVersion },
              { label: 'Stable',     value: env.stableVersion },
              { label: 'Error rate', value: `${env.errorRate.toFixed(2)}%`, danger: env.errorRate > 0.5 },
              { label: 'p99',        value: `${env.p99Latency}ms`,          danger: env.p99Latency > 300 },
            ].map((m) => (
              <div key={m.label} className="px-4 py-3 bg-surface">
                <p className="text-[9px] uppercase tracking-wider text-ink-quaternary mb-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{m.label}</p>
                <p className={`text-[13px] font-medium ${'danger' in m && m.danger ? 'text-signal-danger' : 'text-ink'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Logs ─────────────────────────────────────────────────────────────

const FAKE_LOG_LINES = [
  { ts: '09:42:03.112', level: 'INFO',  msg: 'GET /api/v1/users 200 12ms' },
  { ts: '09:42:03.228', level: 'INFO',  msg: 'GET /api/v1/health 200 1ms' },
  { ts: '09:42:04.001', level: 'INFO',  msg: 'POST /api/v1/auth/token 200 34ms' },
  { ts: '09:42:04.415', level: 'WARN',  msg: 'Upstream timeout: recommendations-service 198ms' },
  { ts: '09:42:04.416', level: 'INFO',  msg: 'Retrying upstream call (attempt 1/3)' },
  { ts: '09:42:04.890', level: 'INFO',  msg: 'Upstream recovered 312ms' },
  { ts: '09:42:05.003', level: 'INFO',  msg: 'GET /api/v1/catalog 200 28ms' },
  { ts: '09:42:05.782', level: 'INFO',  msg: 'Canary weight promotion check: 25% → evaluating gates' },
  { ts: '09:42:05.783', level: 'INFO',  msg: 'Gate passed: error_rate=0.02% threshold=0.5%' },
  { ts: '09:42:05.784', level: 'INFO',  msg: 'Gate pending: p99_latency=198ms threshold=250ms (within window)' },
  { ts: '09:42:06.100', level: 'INFO',  msg: 'GET /api/v1/orders 200 55ms' },
  { ts: '09:42:06.401', level: 'ERROR', msg: 'Unhandled rejection in middleware chain: TypeError: Cannot read property "id"' },
  { ts: '09:42:06.402', level: 'INFO',  msg: 'Error forwarded to Sentry (event_id: abc123)' },
  { ts: '09:42:07.001', level: 'INFO',  msg: 'GET /api/v1/search?q=shoes 200 41ms' },
  { ts: '09:42:07.330', level: 'INFO',  msg: 'Rate-limit bucket reset for user_tier=pro' },
]

const LOG_LEVEL_COLOR: Record<string, string> = {
  INFO:  'text-ink-tertiary',
  WARN:  'text-amber-500',
  ERROR: 'text-signal-danger',
}

function LogsTab({ serviceName }: { serviceName: string }) {
  const [filter, setFilter] = useState('')
  const filtered = FAKE_LOG_LINES.filter(
    (l) => !filter || l.msg.toLowerCase().includes(filter.toLowerCase()) || l.level === filter.toUpperCase(),
  )

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter logs…"
          className="flex-1 max-w-xs rounded-[2px] border border-line bg-surface px-3 py-1.5 text-[12px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        />
        <span className="text-[10px] text-ink-quaternary ml-1">Live tail · {serviceName} · production</span>
      </div>

      {/* Log lines */}
      <div className="rounded-[2px] border border-line bg-[#0d0d0d] dark:bg-[#0a0a0a] overflow-hidden">
        <div className="px-1 py-1 overflow-x-auto max-h-96 overflow-y-auto">
          {filtered.map((line, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-0.5 hover:bg-white/5 rounded-[1px]">
              <span className="shrink-0 text-[10px] text-slate-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{line.ts}</span>
              <span className={`shrink-0 text-[10px] font-semibold w-10 ${LOG_LEVEL_COLOR[line.level] ?? 'text-slate-400'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{line.level}</span>
              <span className="text-[11px] text-slate-300 leading-relaxed" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{line.msg}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 px-4 py-1.5 flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute h-full w-full rounded-full bg-signal-success opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-signal-success" />
          </span>
          <span className="text-[10px] text-slate-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Live — {filtered.length} lines shown</span>
        </div>
      </div>

      <p className="text-[11px] text-ink-quaternary">
        Showing last 15 minutes. Full log retention and search available on Pro+.
      </p>
    </div>
  )
}

// ─── Tab: Config ──────────────────────────────────────────────────────────

function ConfigTab({ service }: { service: DemoService }) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(`${key}=<redacted>`).catch((err) => {
      console.error('[ServiceDetailPage] clipboard copy failed', err)
      logFrontendEvent({ level: 'error', message: 'clipboard.copy.failed', context: { error: err, location: 'ServiceDetailPage' } })
    })
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            Environment variables
          </h2>
          <span className="text-[10px] text-ink-quaternary">{service.configKeys.length} keys</span>
        </div>

        {service.configKeys.length === 0 ? (
          <p className="text-[12px] text-ink-tertiary">No config keys registered.</p>
        ) : (
          <div className="rounded-[2px] border border-line divide-y divide-line overflow-hidden">
            {service.configKeys.map((key) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5 bg-surface hover:bg-surface-alt transition-colors">
                <span className="text-[12px] font-medium text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{key}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-ink-quaternary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>••••••••</span>
                  <button
                    onClick={() => handleCopy(key)}
                    title="Copy key name"
                    className="rounded-[4px] p-1 text-ink-quaternary hover:text-ink transition-colors focus:outline-none"
                  >
                    {copied === key ? <CheckCheck size={12} className="text-signal-success" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          Rollout config
        </h2>
        <pre className="rounded-[2px] border border-line bg-surface-alt px-4 py-3 text-[11px] text-ink-secondary overflow-x-auto" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
{`service: ${service.serviceName}
runtime: "${service.runtime}"

rollout:
  strategy: ${service.routingStrategy}
  initial_weight: ${service.routingStrategy === 'canary' ? '10' : '50'}
  promotion_window: ${service.routingStrategy === 'canary' ? '10' : '5'}m
  auto_promote: true

  gates:
    - type: error_rate
      threshold: 0.5
      window: 5m
    - type: p99_latency
      threshold: ${service.p99Latency + 50}
      window: 5m
    - type: smoke_tests
      required: true

foresight:
  enabled: true
  block_on_high_risk: false

phoenix:
  enabled: true
  auto_rollback: true
  scope: cohort`}
        </pre>
      </section>
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────

function GateIcon({ status }: { status: 'passed' | 'failed' | 'pending' | 'skipped' }) {
  if (status === 'passed')  return <CheckCircle2 size={13} className="text-signal-success shrink-0" />
  if (status === 'failed')  return <XCircle size={13} className="text-signal-danger shrink-0" />
  if (status === 'pending') return <Clock size={13} className="text-amber-500 shrink-0" />
  return <span className="w-3 h-3 shrink-0 rounded-full border border-line" />
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-ink-quaternary">
      {icon}
      {label}
    </span>
  )
}

function ServiceBreadcrumb({
  orgSlug,
  projectSlug,
  serviceName,
}: {
  orgSlug: string
  projectSlug: string
  serviceName: string
}) {
  return (
    <nav className="flex items-center gap-1.5 mb-6 flex-wrap" aria-label="Breadcrumb">
      {orgSlug && projectSlug && (
        <>
          <Link to="/orgs/$orgId" params={{ orgId: orgSlug }} className="text-[11px] text-ink-tertiary hover:text-ink transition-colors" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {orgSlug}
          </Link>
          <Link to="/orgs/$orgId/projects/$projectId/overview" params={{ orgId: orgSlug, projectId: projectSlug }} className="text-[11px] text-ink-tertiary hover:text-ink transition-colors" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {projectSlug}
          </Link>
          <ChevronRight size={10} className="text-ink-quaternary" />
        </>
      )}
      <span className="text-[11px] text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {serviceName}
      </span>
    </nav>
  )
}
