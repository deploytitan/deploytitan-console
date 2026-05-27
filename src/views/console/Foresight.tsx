'use client'

/**
 * Foresight page — PR risk queue with blast radius, ownership, recommended policy.
 * Route: /foresight
 *
 * Shows all pending and recent PRs scored by Titan Foresight.
 * Each row shows risk score, blast radius, team ownership, and recommended rollout policy.
 *
 * Design notes:
 * - Risk counts live in filter tab labels, not a separate stat tile grid.
 * - Explainer is prose-only; the icon sequence was redundant with the text.
 * - Actionable (high-risk) rows carry stronger visual weight than passive ones.
 */

import { Link, useParams, useSearch, useNavigate } from '@/lib/navigation'
import { DEMO_PR_RISKS, DEMO_ACTIVITY } from '../../lib/demo-data'
import type { DemoPRRisk, RiskLevel, DemoActivityEvent } from '../../lib/demo-data'
import {
  RiskBadge,
  DemoBanner,
  MonoLabel,
  SectionHeader,
  timeSince,
} from '../../components/console/ConsolePrimitives'
import { Eye, GitPullRequest, Users, Layers, BookOpen } from 'lucide-react'

type StatusFilter = 'all' | 'pending_deploy' | 'deployed' | 'blocked'

// Count helpers for tab labels
const countByStatus = (status: Exclude<StatusFilter, 'all'>) =>
  DEMO_PR_RISKS.filter((p) => p.status === status).length

const highRiskCount   = DEMO_PR_RISKS.filter((p) => p.riskLevel === 'high').length
const mediumRiskCount = DEMO_PR_RISKS.filter((p) => p.riskLevel === 'medium').length

const STATUS_FILTERS: { label: string; value: StatusFilter; count?: number }[] = [
  { label: 'All', value: 'all', count: DEMO_PR_RISKS.length },
  { label: 'Pending', value: 'pending_deploy', count: countByStatus('pending_deploy') },
  { label: 'Deployed', value: 'deployed', count: countByStatus('deployed') },
  { label: 'Blocked', value: 'blocked', count: countByStatus('blocked') },
]

export function ForesightPage() {
  const { orgId: orgSlug, projectId: projectSlug } = useParams({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/foresight' })
  const search = useSearch({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/foresight' })
  const navigate = useNavigate({ from: '/orgs/$orgId/projects/$projectId/foresight' })

  const filter = search.status as StatusFilter
  const setFilter = (v: StatusFilter) =>
    navigate({ search: (prev) => ({ ...prev, status: v, pr: undefined }) })

  const expandedId = search.pr ?? null
  const setExpandedId = (id: string | null) =>
    navigate({ search: (prev) => ({ ...prev, pr: id ?? undefined }) })

  const filtered = filter === 'all'
    ? DEMO_PR_RISKS
    : DEMO_PR_RISKS.filter((p) => p.status === filter)

  return (
    <div className="min-h-full">
      {/* TODO: guard with demo flag */}
      <DemoBanner />

      <div className="px-8 py-10 animate-fade-up">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Eye size={18} strokeWidth={1.5} className="text-ink-tertiary mt-0.5 shrink-0" />
            <div>
              <h1
                className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
              >
                Titan Foresight
              </h1>
              <p className="text-[12px] text-ink-tertiary">
                Risk score per PR, before a byte of traffic changes.
              </p>
            </div>
          </div>

          {/* Risk summary inline — replaces stat tile grid */}
          <div className="flex items-center gap-4 shrink-0 pt-0.5">
            {highRiskCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span
                  className="text-[13px] font-semibold text-signal-danger tabular-nums"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {highRiskCount}
                </span>
                <span className="text-[11px] text-ink-tertiary">high risk</span>
              </span>
            )}
            {mediumRiskCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span
                  className="text-[13px] font-semibold text-signal-warning tabular-nums"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {mediumRiskCount}
                </span>
                <span className="text-[11px] text-ink-tertiary">medium risk</span>
              </span>
            )}
          </div>
        </div>

        {/* How Foresight works — prose-only; no decorative icon sequence */}
        <div className="mb-6 rounded-[4px] border border-line bg-surface-alt px-4 py-3">
          <p className="text-[11px] text-ink-tertiary leading-relaxed">
            Foresight scores each PR against your live dependency graph. High-risk changes automatically get tighter rollout policies in Titan Rollout: smaller initial cohorts, shorter promotion windows, mandatory SLO gates.
          </p>
        </div>

        {/* Filter tabs — counts baked in */}
        <div className="flex items-center gap-1 mb-5 border-b border-line">
          {STATUS_FILTERS.map((f) => (
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
              {f.count !== undefined && (
                <span
                  className={[
                    'inline-flex items-center justify-center rounded-full text-[9px] px-1.5 min-w-[18px] h-[18px] leading-none transition-colors duration-150',
                    filter === f.value
                      ? 'bg-ink text-surface'
                      : 'bg-line text-ink-quaternary',
                  ].join(' ')}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* PR list */}
        <div className="space-y-2 animate-stagger">
          {filtered.map((pr) => (
            <PrRiskRow
              key={pr.id}
              pr={pr}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              expanded={expandedId === pr.id}
              onToggle={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="rounded-[4px] border border-dashed border-line px-6 py-8 text-center animate-fade-in">
              <p className="text-[12px] text-ink-tertiary">No PRs match this filter.</p>
            </div>
          )}
        </div>

        {/* Scoped Ledger — Foresight events only */}
        <ForesightLedger />
      </div>
    </div>
  )
}

// ─── Scoped Ledger ────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<DemoActivityEvent['severity'], { dot: string; text: string }> = {
  info:  { dot: 'bg-signal-success',  text: 'text-signal-success' },
  warn:  { dot: 'bg-signal-warning',  text: 'text-signal-warning' },
  error: { dot: 'bg-signal-danger',   text: 'text-signal-danger'  },
}

function ForesightLedger() {
  const events = DEMO_ACTIVITY.filter((e) => e.type === 'pr_analyzed')

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={13} strokeWidth={1.5} className="text-ink-tertiary" />
        <SectionHeader>Foresight ledger</SectionHeader>
        <span className="text-[10px] text-ink-quaternary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          PR analysis events
        </span>
      </div>

      <div className="rounded-[4px] border border-line overflow-hidden">
        {events.length === 0 ? (
          <div className="px-6 py-6 text-center">
            <p className="text-[12px] text-ink-tertiary">No Foresight events yet.</p>
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-line bg-surface-alt">
                {['Time', 'Service', 'Event', 'Detail', 'Actor'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2 text-[9px] uppercase tracking-[0.08em] text-ink-quaternary font-medium"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const sev = SEVERITY_COLORS[ev.severity]
                return (
                  <tr
                    key={ev.id}
                    className={[
                      'border-b border-line/50 hover:bg-surface-alt/60 transition-colors duration-150',
                      i === events.length - 1 ? 'border-b-0' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <MonoLabel dim>{timeSince(ev.ts)}</MonoLabel>
                    </td>
                    <td className="px-4 py-2.5">
                      <MonoLabel>{ev.service ?? '—'}</MonoLabel>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={['w-1.5 h-1.5 rounded-full shrink-0', sev.dot].join(' ')} />
                        <span className="text-ink font-medium">{ev.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary max-w-[280px] truncate">{ev.detail}</td>
                    <td className="px-4 py-2.5">
                      <MonoLabel dim>{ev.actor}</MonoLabel>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── PR Risk Row ──────────────────────────────────────────────────────────────

function PrRiskRow({
  pr,
  orgSlug,
  projectSlug,
  expanded,
  onToggle,
}: {
  pr: DemoPRRisk
  orgSlug: string | null
  projectSlug: string | null
  expanded: boolean
  onToggle: () => void
}) {
  // High-risk rows are more visually prominent; medium/low recede.
  const isHighRisk = pr.riskLevel === 'high'

  const borderColor =
    pr.riskLevel === 'high'   ? 'border-signal-danger/25'  :
    pr.riskLevel === 'medium' ? 'border-signal-warning/20' :
    'border-line'

  const bgColor =
    pr.riskLevel === 'high'   ? 'bg-signal-danger/4'  :
    pr.riskLevel === 'medium' ? 'bg-signal-warning/3' :
    'bg-surface'

  return (
    <div className={['rounded-[4px] border overflow-hidden transition-shadow duration-150', borderColor, bgColor].join(' ')}>
      {/* Summary row */}
      <button
        className="w-full text-left flex items-start gap-4 px-4 py-4 hover:bg-white/20 transition-colors duration-150"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {/* Risk score tile */}
        <RiskScoreIndicator score={pr.riskScore} level={pr.riskLevel} />

        {/* PR info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-[11px] text-ink font-medium"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              #{pr.prNumber}
            </span>
            <span className={['text-[12px] font-medium truncate', isHighRisk ? 'text-ink' : 'text-ink-secondary'].join(' ')}>
              {pr.prTitle}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <GitPullRequest size={10} strokeWidth={2} className="text-ink-quaternary" />
              <MonoLabel dim>{pr.service}</MonoLabel>
            </div>
            <div className="flex items-center gap-1">
              <Layers size={10} strokeWidth={2} className="text-ink-quaternary" />
              <MonoLabel dim>{pr.blastRadiusCount} service{pr.blastRadiusCount !== 1 ? 's' : ''} affected</MonoLabel>
            </div>
            <div className="flex items-center gap-1">
              <Users size={10} strokeWidth={2} className="text-ink-quaternary" />
              <MonoLabel dim>{pr.primaryOwner}</MonoLabel>
            </div>
          </div>
        </div>

        {/* Right side badges */}
        <div className="flex items-center gap-2 shrink-0">
          <RiskBadge level={pr.riskLevel} score={pr.riskScore} />
          <PrStatusBadge status={pr.status} />
          <MonoLabel dim>{timeSince(pr.analyzedAt)}</MonoLabel>
          <span
            className={[
              'text-ink-quaternary transition-transform duration-200 ease-out',
              expanded ? 'rotate-90' : 'rotate-0',
            ].join(' ')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-line/50 animate-slide-down">
          <div className="grid grid-cols-2 gap-4">
            {/* Blast radius */}
            <div>
              <p
                className="text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-2"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                Blast radius
              </p>
              <div className="space-y-1">
                {pr.affectedServices.map((svcName, i) => (
                  <div key={svcName} className="flex items-center gap-2">
                    <div
                      className={[
                        'w-1 h-1 rounded-full shrink-0',
                        i === 0 ? 'bg-signal-danger' : 'bg-signal-warning/60',
                      ].join(' ')}
                    />
                    <Link
                      to="/orgs/$orgId/projects/$projectId/services/$serviceName"
                      params={{ orgId: orgSlug!, projectId: projectSlug!, serviceName: encodeURIComponent(svcName) }}
                      className="text-[11px] text-ink-secondary hover:text-ink transition-colors duration-150"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {svcName}
                    </Link>
                    {i === 0 && (
                      <span className="text-[9px] text-ink-quaternary">(primary)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rollout policy */}
            <div>
              <p
                className="text-[9px] uppercase tracking-[0.1em] text-ink-quaternary mb-2"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                Recommended rollout policy
              </p>
              <div className="rounded-[4px] border border-line bg-surface px-3 py-2">
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  {pr.recommendedPolicy}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span
                  className="text-[9px] text-ink-quaternary"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  Owner:
                </span>
                <span
                  className="text-[9px] text-ink-tertiary"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {pr.primaryOwner}
                </span>
                {pr.secondaryOwner && (
                  <>
                    <span className="text-ink-quaternary text-[9px]">+</span>
                    <span
                      className="text-[9px] text-ink-tertiary"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {pr.secondaryOwner}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RiskScoreIndicator({ score, level }: { score: number; level: RiskLevel }) {
  const colorMap: Record<RiskLevel, string> = {
    high:   'text-signal-danger border-signal-danger/30 bg-signal-danger/8',
    medium: 'text-signal-warning border-signal-warning/30 bg-signal-warning/8',
    low:    'text-signal-success border-signal-success/30 bg-signal-success/8',
  }
  return (
    <div
      className={[
        'w-10 h-10 rounded-[4px] border flex items-center justify-center shrink-0',
        colorMap[level],
      ].join(' ')}
    >
      <span
        className="text-[14px] font-semibold leading-none tabular-nums"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {score}
      </span>
    </div>
  )
}

function PrStatusBadge({ status }: { status: DemoPRRisk['status'] }) {
  const cfg = {
    pending_deploy: { label: 'PENDING',  bg: 'bg-signal-deploy/10',  border: 'border-signal-deploy/20',  text: 'text-signal-deploy' },
    deployed:       { label: 'DEPLOYED', bg: 'bg-signal-success/10', border: 'border-signal-success/20', text: 'text-signal-success' },
    blocked:        { label: 'BLOCKED',  bg: 'bg-signal-danger/10',  border: 'border-signal-danger/20',  text: 'text-signal-danger' },
  }[status]

  return (
    <span
      className={['inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[8px] tracking-[0.1em] leading-none font-medium', cfg.bg, cfg.border, cfg.text].join(' ')}
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {cfg.label}
    </span>
  )
}
