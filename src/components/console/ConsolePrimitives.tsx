'use client'

/**
 * Shared console UI primitives.
 * StatusBadge, HealthDot, MonoLabel, SectionHeader, RiskBadge, TimeSince.
 *
 * Radius convention: rounded-[4px] throughout the console (friendly-engineered).
 * Badge micro-elements use rounded-[2px] to retain precision at small scale.
 */

import type { DeployStatus, RiskLevel, ServiceHealth } from '../../lib/demo-data'

// ─── Status Badge ─────────────────────────────────────────────────────────────

const DEPLOY_STATUS_CFG: Record<
  DeployStatus,
  { label: string; bg: string; border: string; text: string }
> = {
  canary: {
    label: 'CANARY',
    bg: 'bg-signal-deploy/10 dark:bg-dark-signal-deploy/10',
    border: 'border-signal-deploy/25 dark:border-dark-signal-deploy/25',
    text: 'text-signal-deploy dark:text-dark-signal-deploy',
  },
  deploying: {
    label: 'DEPLOYING',
    bg: 'bg-signal-deploy/10 dark:bg-dark-signal-deploy/10',
    border: 'border-signal-deploy/25 dark:border-dark-signal-deploy/25',
    text: 'text-signal-deploy dark:text-dark-signal-deploy',
  },
  completed: {
    label: 'DEPLOYED',
    bg: 'bg-signal-success/10 dark:bg-dark-signal-success/10',
    border: 'border-signal-success/25 dark:border-dark-signal-success/25',
    text: 'text-signal-success dark:text-dark-signal-success',
  },
  failed: {
    label: 'FAILED',
    bg: 'bg-signal-danger/10 dark:bg-dark-signal-danger/10',
    border: 'border-signal-danger/25 dark:border-dark-signal-danger/25',
    text: 'text-signal-danger dark:text-dark-signal-danger',
  },
  rolled_back: {
    label: 'ROLLED BACK',
    bg: 'bg-signal-warning/10 dark:bg-dark-signal-warning/10',
    border: 'border-signal-warning/25 dark:border-dark-signal-warning/25',
    text: 'text-signal-warning dark:text-dark-signal-warning',
  },
}

export function DeployStatusBadge({ status }: { status: DeployStatus | string }) {
  const cfg = DEPLOY_STATUS_CFG[status as DeployStatus] ?? {
    label: status.toUpperCase().replace('_', ' '),
    bg: 'bg-line-subtle',
    border: 'border-line',
    text: 'text-ink-tertiary',
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-[2px] border px-1.5 py-0.5',
        'text-[8px] tracking-[0.1em] leading-none font-medium whitespace-nowrap',
        cfg.bg, cfg.border, cfg.text,
      ].join(' ')}
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {cfg.label}
    </span>
  )
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

const RISK_CFG: Record<RiskLevel, { label: string; bg: string; border: string; text: string }> = {
  low: {
    label: 'LOW',
    bg: 'bg-signal-success/10 dark:bg-dark-signal-success/10',
    border: 'border-signal-success/20',
    text: 'text-signal-success dark:text-dark-signal-success',
  },
  medium: {
    label: 'MEDIUM',
    bg: 'bg-signal-warning/10 dark:bg-dark-signal-warning/10',
    border: 'border-signal-warning/20',
    text: 'text-signal-warning dark:text-dark-signal-warning',
  },
  high: {
    label: 'HIGH',
    bg: 'bg-signal-danger/10 dark:bg-dark-signal-danger/10',
    border: 'border-signal-danger/20',
    text: 'text-signal-danger dark:text-dark-signal-danger',
  },
}

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const cfg = RISK_CFG[level]
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5',
        'text-[8px] tracking-[0.1em] leading-none font-medium whitespace-nowrap',
        cfg.bg, cfg.border, cfg.text,
      ].join(' ')}
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {score !== undefined && <span className="opacity-70">{score}</span>}
      {cfg.label}
    </span>
  )
}

// ─── Health Dot ───────────────────────────────────────────────────────────────

const HEALTH_CFG: Record<ServiceHealth, { color: string; label: string; pulse: boolean }> = {
  healthy:  { color: 'bg-signal-success dark:bg-dark-signal-success',  label: 'Healthy',  pulse: false },
  degraded: { color: 'bg-signal-warning dark:bg-dark-signal-warning',  label: 'Degraded', pulse: false },
  incident: { color: 'bg-signal-danger dark:bg-dark-signal-danger',    label: 'Incident', pulse: true  },
}

export function HealthDot({ health }: { health: ServiceHealth }) {
  const cfg = HEALTH_CFG[health]
  return (
    <span
      className={[
        'block w-1.5 h-1.5 rounded-full shrink-0',
        cfg.color,
        cfg.pulse ? 'animate-pulse-dot' : '',
      ].join(' ')}
      aria-label={cfg.label}
      title={cfg.label}
    />
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2
        className="text-[10px] font-semibold text-ink uppercase tracking-[0.1em]"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {children}
      </h2>
      {right && (
        <span
          className="text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {right}
        </span>
      )}
    </div>
  )
}

// ─── Mono Label ───────────────────────────────────────────────────────────────

export function MonoLabel({
  children,
  dim,
}: {
  children: React.ReactNode
  dim?: boolean
}) {
  return (
    <span
      className={['text-[10px] tracking-wide', dim ? 'text-ink-quaternary' : 'text-ink-tertiary'].join(' ')}
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {children}
    </span>
  )
}

// ─── Time Since ───────────────────────────────────────────────────────────────

export function timeSince(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatTs(ms: number): string {
  const d = new Date(ms)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}

// ─── Demo Banner ──────────────────────────────────────────────────────────────

export function DemoBanner() {
  return (
    <div
      className="mx-8 mt-8 flex items-center gap-3 rounded-[4px] border border-primary/20 bg-primary-muted px-4 py-3 animate-fade-in"
      role="status"
    >
      <span
        className="text-[9px] uppercase tracking-[0.12em] text-primary-dark font-semibold shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        Demo mode
      </span>
      <span className="text-[11px] text-ink-secondary">
        Showing sample data. Connect a service via the CLI to see real deployments.
      </span>
      <code
        className="ml-auto rounded-[3px] bg-surface border border-line px-2 py-0.5 text-[10px] text-ink-tertiary shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        dt connect --service my-api
      </code>
    </div>
  )
}

// ─── SLO Bar ─────────────────────────────────────────────────────────────────

export function SloBar({
  label,
  value,
  threshold,
  unit,
  higherIsBad = true,
}: {
  label: string
  value: number
  threshold: number
  unit: string
  higherIsBad?: boolean
}) {
  const ratio = higherIsBad
    ? Math.min(value / threshold, 1)
    : Math.min(threshold / value, 1)

  const isBreaching = higherIsBad ? value >= threshold * 0.8 : value <= threshold * 1.2
  const isCritical = higherIsBad ? value >= threshold : value <= threshold

  const barColor = isCritical
    ? 'bg-signal-danger dark:bg-dark-signal-danger'
    : isBreaching
    ? 'bg-signal-warning dark:bg-dark-signal-warning'
    : 'bg-signal-success dark:bg-dark-signal-success'

  const displayValue = `${value}${unit}`
  const displayThreshold = `${threshold}${unit}`

  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className="text-[9px] uppercase tracking-[0.08em] text-ink-quaternary w-20 shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </span>
      <div className="flex-1 h-1 bg-line rounded-full overflow-hidden">
        <div
          className={['h-full transition-all duration-700 ease-out', barColor].join(' ')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        className={[
          'text-[9px] w-14 text-right shrink-0',
          isCritical ? 'text-signal-danger dark:text-dark-signal-danger' : 'text-ink-tertiary',
        ].join(' ')}
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {displayValue}
      </span>
      <span
        className="text-[9px] text-ink-quaternary w-12 text-right shrink-0"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        /{displayThreshold}
      </span>
    </div>
  )
}

// ─── Inline status strip ──────────────────────────────────────────────────────
// Used by Rollback and other pages in place of the 3-tile stat grid.

export function StatStrip({ items }: {
  items: { label: string; value: string; colorClass?: string }[]
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-ink-quaternary/40 mx-1 select-none">·</span>}
          <span
            className={['text-[12px] font-semibold tabular-nums', item.colorClass ?? 'text-ink'].join(' ')}
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {item.value}
          </span>
          <span
            className="text-[11px] text-ink-tertiary"
            style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
          >
            {item.label}
          </span>
        </span>
      ))}
    </div>
  )
}
