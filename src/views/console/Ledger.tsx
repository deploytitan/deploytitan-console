'use client'

/**
 * Ledger page — Titan Ledger.
 * Route: /ledger
 *
 * Cross-product, full-history event log.
 * Every event from Rollouts, Foresight, and Phoenix flows here.
 * Primary use: post-mortems, compliance audits, governance.
 *
 * Audit-grade features:
 * - Date range filter (preset + custom)
 * - CSV export
 * - Expandable rows with full event payload detail
 * - Event type legend explaining each category
 */

import { useState, useMemo } from 'react'
import { Link, useParams, useSearch, useNavigate } from '@/lib/navigation'
import { DEMO_ACTIVITY } from '../../lib/demo-data'
import type { DemoActivityEvent } from '../../lib/demo-data'
import {
  DemoBanner,
  MonoLabel,
  timeSince,
  formatTs,
} from '../../components/console/ConsolePrimitives'
import {
  BookOpen,
  Rocket,
  RotateCcw,
  Eye,
  Settings,
  Users,
  Plug,
  AlertTriangle,
  ChevronRight,
  Download,
  HelpCircle,
  X,
} from 'lucide-react'

// ─── Filter config ─────────────────────────────────────────────────────────────

type EventTypeFilter = 'all' | DemoActivityEvent['type']
type SeverityFilter  = 'all' | DemoActivityEvent['severity']
type DateRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom'

const TYPE_FILTERS: { label: string; value: EventTypeFilter; description: string }[] = [
  { label: 'All events',    value: 'all',            description: 'Every event across all products' },
  { label: 'Deployments',   value: 'deploy',         description: 'Canary promotions, full deploys, rollout completions' },
  { label: 'Rollbacks',     value: 'rollback',       description: 'Phoenix-triggered and manual rollback events' },
  { label: 'Risk analysis', value: 'pr_analyzed',    description: 'Foresight PR risk scores and policy recommendations' },
  { label: 'Config',        value: 'config_change',  description: 'SLO thresholds, rollout policies, integration settings' },
  { label: 'Members',       value: 'member_joined',  description: 'Team membership changes, role assignments' },
]

const DATE_PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: '24h',    value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
]

const PRESET_MS: Record<Exclude<DateRangePreset, 'custom'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}

// ─── Event type icons ──────────────────────────────────────────────────────────

const EVENT_ICON_MAP: Record<DemoActivityEvent['type'], React.ReactNode> = {
  deploy:          <Rocket size={12} strokeWidth={1.75} />,
  rollback:        <RotateCcw size={12} strokeWidth={1.75} />,
  incident:        <AlertTriangle size={12} strokeWidth={1.75} />,
  pr_analyzed:     <Eye size={12} strokeWidth={1.75} />,
  config_change:   <Settings size={12} strokeWidth={1.75} />,
  member_joined:   <Users size={12} strokeWidth={1.75} />,
  integration_added: <Plug size={12} strokeWidth={1.75} />,
}

function EventIcon({ type, severity }: { type: DemoActivityEvent['type']; severity: DemoActivityEvent['severity'] }) {
  const bgClass =
    severity === 'error' ? 'bg-signal-danger/8 border-signal-danger/15 text-signal-danger' :
    severity === 'warn'  ? 'bg-signal-warning/8 border-signal-warning/15 text-signal-warning' :
    'bg-surface-alt border-line text-ink-tertiary'

  return (
    <div
      className={['w-6 h-6 rounded-[4px] border flex items-center justify-center shrink-0', bgClass].join(' ')}
      aria-hidden="true"
    >
      {EVENT_ICON_MAP[type]}
    </div>
  )
}

// ─── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(events: DemoActivityEvent[]) {
  const header = 'timestamp,type,severity,service,actor,title,detail'
  const rows = events.map((e) =>
    [
      new Date(e.ts).toISOString(),
      e.type,
      e.severity,
      e.service ?? '',
      e.actor,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.detail.replace(/"/g, '""')}"`,
    ].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `deploytitan-ledger-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LedgerPage() {
  const { orgSlug, projectSlug } = useParams({ strict: false }) as { orgSlug?: string; projectSlug?: string }
  const search = useSearch({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/ledger' })
  const navigate = useNavigate({ from: '/orgs/$orgId/projects/$projectId/ledger' })

  const typeFilter     = search.type as EventTypeFilter
  const severityFilter = search.severity as SeverityFilter
  const datePreset     = search.range as DateRangePreset
  const expandedId     = search.event ?? null

  const setTypeFilter     = (v: EventTypeFilter)    => navigate({ search: (prev) => ({ ...prev, type: v }) })
  const setSeverityFilter = (v: SeverityFilter)     => navigate({ search: (prev) => ({ ...prev, severity: v }) })
  const setDatePreset     = (v: DateRangePreset)    => navigate({ search: (prev) => ({ ...prev, range: v as Exclude<DateRangePreset, 'custom'> }) })
  const setExpandedId     = (id: string | null)     => navigate({ search: (prev) => ({ ...prev, event: id ?? undefined }) })

  const [showLegend, setShowLegend] = useState(false)

  const cutoff = datePreset !== 'custom'
    ? Date.now() - PRESET_MS[datePreset as Exclude<DateRangePreset, 'custom'>]
    : 0

  const filtered = useMemo(() => DEMO_ACTIVITY.filter((event) => {
    if (typeFilter !== 'all'     && event.type     !== typeFilter)     return false
    if (severityFilter !== 'all' && event.severity !== severityFilter) return false
    if (datePreset !== 'custom'  && event.ts < cutoff)                 return false
    return true
  }), [typeFilter, severityFilter, datePreset, cutoff])

  const errorCount = filtered.filter((e) => e.severity === 'error').length
  const warnCount  = filtered.filter((e) => e.severity === 'warn').length

  const currentTypeLabel = TYPE_FILTERS.find((f) => f.value === typeFilter)?.label ?? 'All events'

  return (
    <div className="min-h-full">
      {/* TODO: guard with demo flag */}
      <DemoBanner />

      <div className="px-8 py-10 animate-fade-up">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen size={18} strokeWidth={1.5} className="text-ink-tertiary mt-0.5 shrink-0" />
            <div>
              <h1
                className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
              >
                Ledger
              </h1>
              <p className="text-[12px] text-ink-tertiary">
                The complete record. Every deployment, rollback, risk signal, and configuration change, in sequence.
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowLegend((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-ink-tertiary hover:text-ink rounded-[4px] border border-line hover:border-ink/30 transition-colors duration-150"
              style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              title="Event type guide"
            >
              <HelpCircle size={12} strokeWidth={1.75} />
              Guide
            </button>
            <button
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[4px] border border-line bg-surface hover:border-ink/30 text-ink transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              title={`Export ${filtered.length} events as CSV`}
            >
              <Download size={12} strokeWidth={2} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Event type legend — collapsible */}
        {showLegend && (
          <div className="mb-6 rounded-[4px] border border-line bg-surface-alt px-4 py-4 animate-slide-down">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[9px] uppercase tracking-[0.1em] text-ink-quaternary font-medium"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                Event types
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className="text-ink-quaternary hover:text-ink transition-colors duration-150"
                aria-label="Close guide"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {TYPE_FILTERS.filter((f) => f.value !== 'all').map((f) => (
                <div key={f.value} className="flex items-start gap-2">
                  <span className="text-ink-tertiary mt-0.5 shrink-0">
                    {EVENT_ICON_MAP[f.value as DemoActivityEvent['type']]}
                  </span>
                  <div>
                    <span
                      className="text-[11px] font-medium text-ink block"
                      style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
                    >
                      {f.label}
                    </span>
                    <span className="text-[10px] text-ink-tertiary">{f.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter bar: severity chips + date range + type tabs */}
        <div className="space-y-3 mb-5">
          {/* Severity + date range row */}
          <div className="flex items-center justify-between gap-4">
            {/* Severity chips */}
            <div className="flex items-center gap-2">
              <SeverityChip label="All" active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} />
              <SeverityChip
                label={`${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                active={severityFilter === 'error'}
                onClick={() => setSeverityFilter('error')}
                colorClass="text-signal-danger border-signal-danger/20 bg-signal-danger/5"
                activeColorClass="bg-signal-danger/15 border-signal-danger/30 text-signal-danger"
              />
              <SeverityChip
                label={`${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
                active={severityFilter === 'warn'}
                onClick={() => setSeverityFilter('warn')}
                colorClass="text-signal-warning border-signal-warning/20 bg-signal-warning/5"
                activeColorClass="bg-signal-warning/15 border-signal-warning/30 text-signal-warning"
              />
            </div>

            {/* Date range presets */}
            <div className="flex items-center gap-1 rounded-[4px] border border-line bg-surface-alt p-0.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  className={[
                    'px-2.5 py-1 text-[10px] rounded-[3px] transition-colors duration-150',
                    datePreset === p.value
                      ? 'bg-ink text-surface font-medium'
                      : 'text-ink-tertiary hover:text-ink',
                  ].join(' ')}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter tabs */}
          <div className="flex items-center gap-1 border-b border-line">
            {TYPE_FILTERS.map((f) => {
              const count = f.value === 'all'
                ? filtered.length
                : DEMO_ACTIVITY.filter((e) => e.type === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 text-[11px] border-b-2 -mb-px transition-colors duration-150',
                    typeFilter === f.value
                      ? 'border-ink text-ink font-medium'
                      : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
                  ].join(' ')}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  title={f.description}
                >
                  {f.label}
                  <span
                    className={[
                      'inline-flex items-center justify-center rounded-full text-[9px] px-1.5 min-w-[18px] h-[18px] leading-none transition-colors duration-150',
                      typeFilter === f.value
                        ? 'bg-ink text-surface'
                        : 'bg-line text-ink-quaternary',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            {typeFilter !== 'all' ? ` · ${currentTypeLabel}` : ''}
            {severityFilter !== 'all' ? ` · ${severityFilter}` : ''}
          </span>
        </div>

        {/* Event log */}
        {filtered.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-line px-6 py-8 text-center animate-fade-in">
            <p className="text-[12px] text-ink-tertiary">No events match this filter.</p>
          </div>
        ) : (
          <div className="rounded-[4px] border border-line overflow-hidden divide-y divide-line animate-stagger">
            {filtered.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            orgSlug={orgSlug ?? null}
            projectSlug={projectSlug ?? null}
                expanded={expandedId === event.id}
                onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        <p
          className="mt-4 text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Events from Rollouts, Foresight, and Phoenix. Export CSV for offline audit or compliance review.
        </p>
      </div>
    </div>
  )
}

// ─── Event row ─────────────────────────────────────────────────────────────────

const PRODUCT_LABEL: Record<DemoActivityEvent['type'], string> = {
  deploy:            'Rollouts',
  rollback:          'Phoenix',
  incident:          'Phoenix',
  pr_analyzed:       'Foresight',
  config_change:     'Ledger',
  member_joined:     'Ledger',
  integration_added: 'Ledger',
}

const PRODUCT_COLOR: Record<string, string> = {
  Rollouts:  'text-signal-deploy',
  Phoenix:   'text-signal-danger',
  Foresight: 'text-signal-warning',
  Ledger:    'text-ink-quaternary',
}

function EventRow({
  event,
  orgSlug,
  projectSlug,
  expanded,
  onToggle,
}: {
  event: DemoActivityEvent
  orgSlug: string | null
  projectSlug: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const productLabel = PRODUCT_LABEL[event.type]
  const productColor = PRODUCT_COLOR[productLabel] ?? 'text-ink-quaternary'

  return (
    <div>
      <button
        className="w-full text-left flex items-start gap-3 px-4 py-4 bg-surface hover:bg-surface-alt transition-colors duration-150"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {/* Icon */}
        <div className="mt-0.5">
          <EventIcon type={event.type} severity={event.severity} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[12px] font-medium text-ink">{event.title}</span>
            {event.service && (
              <Link
                {...(orgSlug && projectSlug
                    ? { to: '/orgs/$orgId/projects/$projectId/services/$serviceName' as const, params: { orgId: orgSlug!, projectId: projectSlug!, serviceName: encodeURIComponent(event.service) } }
                   : { to: '/onboarding/create-org' as const })}
                className="text-[10px] text-ink-tertiary hover:text-ink transition-colors duration-150"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
                onClick={(e) => e.stopPropagation()}
              >
                {event.service}
              </Link>
            )}
          </div>
          <p className="text-[11px] text-ink-secondary leading-relaxed truncate max-w-prose">
            {event.detail}
          </p>
        </div>

        {/* Right meta */}
        <div className="shrink-0 flex flex-col items-end gap-1 text-right">
          <span
            className={['text-[8px] uppercase tracking-[0.08em] font-medium', productColor].join(' ')}
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {productLabel}
          </span>
          <span
            className="text-[10px] text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {timeSince(event.ts)}
          </span>
          <span
            className="text-[9px] text-ink-quaternary/60"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {event.actor}
          </span>
        </div>

        {/* Expand toggle */}
        <span
          className={[
            'text-ink-quaternary/60 transition-transform duration-200 ease-out mt-1 shrink-0',
            expanded ? 'rotate-90' : 'rotate-0',
          ].join(' ')}
        >
          <ChevronRight size={11} strokeWidth={1.75} />
        </span>
      </button>

      {/* Expanded payload detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-line/50 bg-surface-alt animate-slide-down">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <EventDetailRow label="Event ID" value={event.id} mono />
            <EventDetailRow label="Timestamp" value={formatTs(event.ts)} mono />
            <EventDetailRow label="Type" value={event.type} mono />
            <EventDetailRow label="Severity" value={event.severity} mono />
            {event.service && (
              <div className="flex items-start gap-3">
                <span
                  className="text-[9px] uppercase tracking-[0.08em] text-ink-quaternary w-24 shrink-0 pt-0.5"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  Service
                </span>
                <Link
                  {...(orgSlug && projectSlug
                  ? { to: '/orgs/$orgId/projects/$projectId/services/$serviceName' as const, params: { orgId: orgSlug!, projectId: projectSlug!, serviceName: encodeURIComponent(event.service) } }
                    : { to: '/onboarding/create-org' as const })}
                  className="text-[11px] text-signal-deploy hover:underline"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {event.service}
                </Link>
              </div>
            )}
            <EventDetailRow label="Actor" value={event.actor} mono />
            <div className="col-span-2">
              <EventDetailRow label="Detail" value={event.detail} />
            </div>
            {/* Additional metadata if present */}
            {(event as any).metadata && Object.entries((event as any).metadata).map(([k, v]) => (
              <EventDetailRow key={k} label={k} value={String(v)} mono />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EventDetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="text-[9px] uppercase tracking-[0.08em] text-ink-quaternary w-24 shrink-0 pt-0.5"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </span>
      <span
        className="text-[11px] text-ink-secondary break-all"
        style={mono ? { fontFamily: 'JetBrains Mono, monospace' } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Severity chip ─────────────────────────────────────────────────────────────

function SeverityChip({
  label,
  active,
  onClick,
  colorClass     = 'text-ink-tertiary border-line bg-surface',
  activeColorClass = 'bg-ink text-surface border-ink',
}: {
  label: string
  active: boolean
  onClick: () => void
  colorClass?: string
  activeColorClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-2.5 py-1 rounded-[4px] border text-[10px] transition-colors duration-150',
        active ? activeColorClass : colorClass,
      ].join(' ')}
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {label}
    </button>
  )
}
