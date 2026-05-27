'use client'

/**
 * Timeline page — Titan Ledger: Deployment Timeline view.
 * Route: /orgs/:orgSlug/projects/:projectSlug/timeline
 *
 * Horizontal swim-lane timeline of all deployment-related events across
 * every service in the project. Each service gets a lane; events appear
 * as colored marks at the correct position on the shared time axis.
 *
 * Primary use case: post-incident review — correlate a deploy on one service
 * with a downstream incident on another within the same time window.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useParams, useSearch, useNavigate } from '@/lib/navigation'
import {
  Rocket,
  RotateCcw,
  AlertTriangle,
  Eye,
  Settings,
  Users,
  Plug,
  ChevronDown,
  ChevronUp,
  Filter,
  Clock,
  Check,
} from 'lucide-react'
import { DEMO_TIMELINE_EVENTS, DEMO_SERVICES } from '../../lib/demo-data'
import type { DemoActivityEvent } from '../../lib/demo-data'
import { DemoBanner, MonoLabel, formatTs, timeSince } from '../../components/console/ConsolePrimitives'

// ─── Types ────────────────────────────────────────────────────────────────────

type RangePreset = '24h' | '7d' | '30d' | '90d'
type EventTypeFilter = 'all' | DemoActivityEvent['type']

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_MS: Record<RangePreset, number> = {
  '24h':  24 * 60 * 60 * 1000,
  '7d':    7 * 24 * 60 * 60 * 1000,
  '30d':  30 * 24 * 60 * 60 * 1000,
  '90d':  90 * 24 * 60 * 60 * 1000,
}

const RANGE_PRESETS: { label: string; value: RangePreset }[] = [
  { label: '24h',     value: '24h' },
  { label: '7 days',  value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
]

const EVENT_TYPE_FILTERS: { label: string; value: EventTypeFilter }[] = [
  { label: 'All',     value: 'all' },
  { label: 'Deploy',  value: 'deploy' },
  { label: 'Rollback', value: 'rollback' },
  { label: 'Incident', value: 'incident' },
  { label: 'Foresight', value: 'pr_analyzed' },
  { label: 'Config',  value: 'config_change' },
]

// Event mark styling — color per type × severity
function eventColor(event: DemoActivityEvent): string {
  if (event.severity === 'error') return 'var(--color-signal-danger)'
  if (event.type === 'rollback') return 'var(--color-signal-danger)'
  if (event.type === 'incident') return 'var(--color-signal-danger)'
  if (event.type === 'deploy')   return 'var(--color-signal-deploy)'
  if (event.type === 'pr_analyzed') {
    if (event.severity === 'warn') return 'var(--color-signal-warning)'
    return 'var(--color-ink-quaternary)'
  }
  if (event.type === 'config_change') return 'var(--color-signal-warning)'
  return 'var(--color-ink-quaternary)'
}

function eventBgColor(event: DemoActivityEvent): string {
  if (event.severity === 'error') return 'rgba(239,68,68,0.12)'
  if (event.type === 'rollback') return 'rgba(239,68,68,0.12)'
  if (event.type === 'incident') return 'rgba(239,68,68,0.12)'
  if (event.type === 'deploy')   return 'rgba(59,130,246,0.12)'
  if (event.type === 'pr_analyzed') {
    if (event.severity === 'warn') return 'rgba(245,158,11,0.12)'
    return 'rgba(0,0,0,0.06)'
  }
  if (event.type === 'config_change') return 'rgba(245,158,11,0.12)'
  return 'rgba(0,0,0,0.06)'
}

function EventIcon({ type, size = 11 }: { type: DemoActivityEvent['type']; size?: number }) {
  const props = { size, strokeWidth: 1.75 }
  switch (type) {
    case 'deploy':           return <Rocket {...props} />
    case 'rollback':         return <RotateCcw {...props} />
    case 'incident':         return <AlertTriangle {...props} />
    case 'pr_analyzed':      return <Eye {...props} />
    case 'config_change':    return <Settings {...props} />
    case 'member_joined':    return <Users {...props} />
    case 'integration_added': return <Plug {...props} />
    default:                 return <Clock {...props} />
  }
}

// ─── Source product label ──────────────────────────────────────────────────────

const SOURCE_LABEL: Record<DemoActivityEvent['type'], string> = {
  deploy:            'Rollouts',
  rollback:          'Phoenix',
  incident:          'Phoenix',
  pr_analyzed:       'Foresight',
  config_change:     'Ledger',
  member_joined:     'Ledger',
  integration_added: 'Ledger',
}

const SOURCE_COLOR_CLASS: Record<DemoActivityEvent['type'], string> = {
  deploy:            'text-signal-deploy',
  rollback:          'text-signal-danger',
  incident:          'text-signal-danger',
  pr_analyzed:       'text-signal-warning',
  config_change:     'text-ink-quaternary',
  member_joined:     'text-ink-quaternary',
  integration_added: 'text-ink-quaternary',
}

// ─── Time axis helpers ─────────────────────────────────────────────────────────

function buildTicks(rangeStart: number, rangeEnd: number): { ts: number; label: string }[] {
  const span = rangeEnd - rangeStart
  const ticks: { ts: number; label: string }[] = []

  // Choose tick interval based on span
  let intervalMs: number
  if (span <= 24 * 60 * 60 * 1000) {
    intervalMs = 2 * 60 * 60 * 1000 // every 2h
  } else if (span <= 7 * 24 * 60 * 60 * 1000) {
    intervalMs = 12 * 60 * 60 * 1000 // every 12h
  } else {
    intervalMs = 24 * 60 * 60 * 1000 // every 1d
  }

  // Align to clean boundaries
  const firstTick = Math.ceil(rangeStart / intervalMs) * intervalMs

  for (let t = firstTick; t <= rangeEnd; t += intervalMs) {
    const d = new Date(t)
    let label: string
    if (span <= 24 * 60 * 60 * 1000) {
      label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } else if (span <= 7 * 24 * 60 * 60 * 1000) {
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      // Show date at midnight, time otherwise
      label = d.getHours() === 0 ? dateStr : timeStr
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    ticks.push({ ts: t, label })
  }

  return ticks
}

function tsToPercent(ts: number, rangeStart: number, rangeEnd: number): number {
  return ((ts - rangeStart) / (rangeEnd - rangeStart)) * 100
}

// ─── Service lane row ──────────────────────────────────────────────────────────

interface LaneRowProps {
  service: string
  displayName: string
  events: DemoActivityEvent[]
  rangeStart: number
  rangeEnd: number
  selectedEventId: string | null
  onSelectEvent: (id: string | null) => void
}

function LaneRow({ service, displayName, events, rangeStart, rangeEnd, selectedEventId, onSelectEvent }: LaneRowProps) {
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null
  const hasSelected = selectedEvent !== null

  return (
    <div className="group">
      {/* Lane row */}
      <div className="flex items-center min-h-[48px] border-b border-line-subtle hover:bg-surface-alt/40 transition-colors duration-150">
        {/* Service label — sticky left */}
        <div
          className="shrink-0 flex items-center gap-2 px-4 border-r border-line-subtle bg-surface"
          style={{ width: '180px', minWidth: '180px' }}
        >
          <div
            className="shrink-0 w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: events.some((e) => e.severity === 'error')
                ? 'var(--color-signal-danger)'
                : events.some((e) => e.severity === 'warn')
                ? 'var(--color-signal-warning)'
                : 'var(--color-signal-success)',
            }}
          />
          <span className="text-[12px] font-medium text-ink truncate" title={displayName}>
            {displayName}
          </span>
          <span className="ml-auto font-mono text-[9px] text-ink-quaternary shrink-0">
            {events.length}
          </span>
        </div>

        {/* Time canvas */}
        <div className="flex-1 relative h-[48px] overflow-visible">
          {/* Lane track line */}
          <div
            className="absolute top-1/2 left-0 right-0 h-px"
            style={{ backgroundColor: 'var(--color-line-subtle)', transform: 'translateY(-50%)' }}
          />

          {events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[9px] text-ink-quaternary/50">no events</span>
            </div>
          )}

          {/* Event marks */}
          {events.map((event) => {
            const pct = tsToPercent(event.ts, rangeStart, rangeEnd)
            const isSelected = event.id === selectedEventId
            const color = eventColor(event)

            return (
              <button
                key={event.id}
                onClick={() => onSelectEvent(isSelected ? null : event.id)}
                title={`${event.title} · ${timeSince(event.ts)}`}
                aria-pressed={isSelected}
                aria-label={`${event.title}: ${event.detail}`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded-[2px]"
                style={{
                  left: `${pct}%`,
                  width: isSelected ? '20px' : '16px',
                  height: isSelected ? '20px' : '16px',
                  backgroundColor: isSelected ? color : eventBgColor(event),
                  border: `1.5px solid ${color}`,
                  color: isSelected ? 'var(--color-surface)' : color,
                  zIndex: isSelected ? 10 : 1,
                  borderRadius: '3px',
                }}
              >
                <EventIcon type={event.type} size={isSelected ? 10 : 9} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Inline expand panel — slides open below the lane */}
      {hasSelected && selectedEvent && (
        <div
          className="border-b border-line bg-surface-alt animate-slide-down"
          style={{ paddingLeft: '180px' }}
        >
          <EventDetailPanel event={selectedEvent} onClose={() => onSelectEvent(null)} />
        </div>
      )}
    </div>
  )
}

// ─── Event detail panel ────────────────────────────────────────────────────────

function EventDetailPanel({ event, onClose }: { event: DemoActivityEvent; onClose: () => void }) {
  const color = eventColor(event)

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-[2px]"
            style={{ backgroundColor: eventBgColor(event), color, border: `1px solid ${color}` }}
          >
            <EventIcon type={event.type} size={12} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{event.title}</p>
            <p className="text-[11px] text-ink-secondary mt-0.5 leading-relaxed">{event.detail}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-ink-tertiary hover:text-ink transition-colors"
          aria-label="Close detail"
        >
          <ChevronUp size={13} />
        </button>
      </div>

      {/* Meta grid */}
      <div
        className="grid gap-x-6 gap-y-2 pt-3 border-t border-line-subtle"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
      >
        <MetaField label="ID" value={event.id} mono />
        <MetaField label="Timestamp" value={formatTs(event.ts)} mono />
        <MetaField label="Type" value={event.type} mono />
        <MetaField
          label="Severity"
          value={event.severity}
          mono
          {...(event.severity === 'error' ? { color: 'var(--color-signal-danger)' }
            : event.severity === 'warn' ? { color: 'var(--color-signal-warning)' }
            : {})}
        />
        {event.service && <MetaField label="Service" value={event.service} mono />}
        <MetaField label="Actor" value={event.actor} />
        <MetaField
          label="Source"
          value={SOURCE_LABEL[event.type]}
          colorClass={SOURCE_COLOR_CLASS[event.type]}
          mono
        />
      </div>
    </div>
  )
}

function MetaField({
  label,
  value,
  mono = false,
  color,
  colorClass,
}: {
  label: string
  value: string | number
  mono?: boolean
  color?: string
  colorClass?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quaternary">
        {label}
      </span>
      <span
        className={[
          mono ? 'font-mono text-[11px]' : 'font-sans text-[12px]',
          'text-ink-secondary',
          colorClass ?? '',
        ].join(' ')}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Time axis bar ─────────────────────────────────────────────────────────────

function TimeAxis({ ticks, rangeStart, rangeEnd }: {
  ticks: { ts: number; label: string }[]
  rangeStart: number
  rangeEnd: number
}) {
  return (
    <div
      className="relative border-b border-line"
      style={{ marginLeft: '180px', height: '28px' }}
    >
      {ticks.map((tick) => {
        const pct = tsToPercent(tick.ts, rangeStart, rangeEnd)
        if (pct < 0 || pct > 100) return null
        return (
          <div
            key={tick.ts}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-2 bg-line-subtle" />
            <span className="font-mono text-[9px] text-ink-quaternary mt-0.5 whitespace-nowrap">
              {tick.label}
            </span>
          </div>
        )
      })}
      {/* "Now" marker */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{ right: '0', backgroundColor: 'var(--color-primary)', opacity: 0.5 }}
      />
      <span
        className="absolute font-mono text-[8px] uppercase tracking-wide"
        style={{ right: '2px', top: '14px', color: 'var(--color-primary)', opacity: 0.7 }}
      >
        now
      </span>
    </div>
  )
}

// ─── Service filter dropdown ───────────────────────────────────────────────────

function ServiceFilterDropdown({
  allServices,
  selected,
  onToggle,
  onClear,
}: {
  allServices: string[]
  selected: Set<string>
  onToggle: (s: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = selected.size > 0 && selected.size < allServices.length
  const label = active
    ? `${selected.size} service${selected.size > 1 ? 's' : ''}`
    : 'All services'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-colors duration-150',
          'border focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
          active
            ? 'border-primary/40 bg-primary-muted text-ink'
            : 'border-line text-ink-secondary hover:border-line hover:text-ink',
        ].join(' ')}
        aria-expanded={open}
      >
        <Filter size={11} strokeWidth={1.75} />
        <span>{label}</span>
        <ChevronDown size={11} strokeWidth={1.75} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 border border-line bg-surface shadow-md"
          style={{ borderRadius: '4px', minWidth: '200px' }}
        >
          <div className="px-3 pt-2.5 pb-1.5 border-b border-line-subtle flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quaternary">Services</span>
            {active && (
              <button
                onClick={() => { onClear(); setOpen(false) }}
                className="font-mono text-[9px] text-ink-tertiary hover:text-ink transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="py-1 max-h-52 overflow-y-auto">
            {allServices.map((svc) => {
              const checked = selected.size === 0 || selected.has(svc)
              return (
                <button
                  key={svc}
                  onClick={() => onToggle(svc)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-ink-secondary hover:text-ink hover:bg-surface-alt transition-colors text-left"
                >
                  <div
                    className="flex-shrink-0 w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors"
                    style={{
                      borderColor: checked ? 'var(--color-primary)' : 'var(--color-line)',
                      backgroundColor: checked ? 'var(--color-primary)' : 'transparent',
                    }}
                  >
                    {checked && <Check size={8} strokeWidth={2.5} style={{ color: 'var(--color-surface)' }} />}
                  </div>
                  <span className="font-mono">{svc}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Time axis placeholder */}
      <div className="h-7 border-b border-line-subtle mb-0" style={{ marginLeft: '180px', backgroundColor: 'var(--color-surface-alt)' }} />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center h-12 border-b border-line-subtle">
          <div className="w-[180px] shrink-0 border-r border-line-subtle px-4">
            <div
              className="h-2.5 rounded-[1px]"
              style={{ width: `${50 + (i * 17) % 40}%`, backgroundColor: 'var(--color-line)' }}
            />
          </div>
          <div className="flex-1 h-full" style={{ backgroundColor: 'var(--color-surface-alt)', opacity: 0.3 }} />
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-9 h-9 flex items-center justify-center rounded-[2px]"
        style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-ink-quaternary)', border: '1px solid var(--color-line)' }}
      >
        <Clock size={16} strokeWidth={1.5} />
      </div>
      <p className="font-mono text-[11px] text-ink-tertiary">{message}</p>
    </div>
  )
}

// ─── isDemoMode ────────────────────────────────────────────────────────────────

function isDemoMode(events: DemoActivityEvent[]) {
  return events.length > 0 && (events[0]?.id ?? '').startsWith('tl-')
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TimelinePage() {
  const params = useParams({ strict: false }) as { orgId?: string; projectId?: string }

  // ── Filter state ──────────────────────────────────────────────────────────
  const [range, setRange] = useState<RangePreset>('7d')
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>('all')
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [loading] = useState(false)

  // ── Derive data ───────────────────────────────────────────────────────────
  const now = Date.now()
  const rangeStart = now - PRESET_MS[range]
  const rangeEnd = now

  const allEvents = DEMO_TIMELINE_EVENTS

  const demo = isDemoMode(allEvents)

  // Get unique services (from both events and DEMO_SERVICES for stable ordering)
  const allServiceNames = useMemo(() => {
    const fromServices = DEMO_SERVICES.map((s) => s.serviceName)
    const fromEvents = [...new Set(allEvents.map((e) => e.service).filter(Boolean) as string[])]
    // Stable order: DEMO_SERVICES order first, then any extras from events
    const seen = new Set<string>()
    const result: string[] = []
    for (const s of fromServices) { seen.add(s); result.push(s) }
    for (const s of fromEvents) { if (!seen.has(s)) { seen.add(s); result.push(s) } }
    return result
  }, [])

  // Filtered events in range + type
  const visibleEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (e.ts < rangeStart || e.ts > rangeEnd) return false
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (selectedServices.size > 0 && e.service && !selectedServices.has(e.service)) return false
      return true
    })
  }, [allEvents, rangeStart, rangeEnd, typeFilter, selectedServices])

  // Group events by service
  const eventsByService = useMemo(() => {
    const map = new Map<string, DemoActivityEvent[]>()
    for (const svc of allServiceNames) map.set(svc, [])
    for (const e of visibleEvents) {
      if (e.service) {
        const arr = map.get(e.service) ?? []
        arr.push(e)
        map.set(e.service, arr)
      }
    }
    return map
  }, [allServiceNames, visibleEvents])

  // Visible service lanes (all by default; filtered if selectedServices)
  const visibleServiceNames = useMemo(() => {
    if (selectedServices.size === 0) return allServiceNames
    return allServiceNames.filter((s) => selectedServices.has(s))
  }, [allServiceNames, selectedServices])

  const ticks = useMemo(() => buildTicks(rangeStart, rangeEnd), [rangeStart, rangeEnd])

  // Service display name lookup
  const displayName = useCallback((svcName: string) => {
    return DEMO_SERVICES.find((s) => s.serviceName === svcName)?.displayName ?? svcName
  }, [])

  // Toggle service filter
  const toggleService = useCallback((svc: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev)
      // If all currently selected (empty set = all), start by selecting just this one
      if (next.size === 0) {
        // select all except clicked — or just click to show only this
        allServiceNames.forEach((s) => { if (s !== svc) next.add(s) })
        // Actually the UX is: clicking one service when "all" selects only that service
        next.clear()
        next.add(svc)
        return next
      }
      if (next.has(svc)) {
        next.delete(svc)
        if (next.size === 0) return new Set() // empty = all
      } else {
        next.add(svc)
        if (next.size === allServiceNames.length) return new Set() // all = empty
      }
      return next
    })
    setSelectedEventId(null)
  }, [allServiceNames])

  const totalEvents = visibleEvents.length
  const hasEvents = totalEvents > 0

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Demo banner */}
      {demo && <DemoBanner />}

      {/* ── Page header ── */}
      <header className="sticky top-0 z-30 bg-surface border-b border-line px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <h1 className="text-[15px] font-semibold text-ink tracking-tight leading-none">
                Timeline
              </h1>
              <p className="font-mono text-[10px] text-ink-quaternary mt-1 uppercase tracking-[0.08em]">
                Titan Ledger · Deployment history
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Service filter */}
            <ServiceFilterDropdown
              allServices={allServiceNames}
              selected={selectedServices}
              onToggle={toggleService}
              onClear={() => setSelectedServices(new Set())}
            />

            {/* Event type chips */}
            <div className="flex items-center gap-1 p-0.5 rounded-[4px] border border-line bg-surface-alt">
              {EVENT_TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setTypeFilter(f.value); setSelectedEventId(null) }}
                  className={[
                    'px-2.5 py-1 rounded-[3px] text-[11px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
                    typeFilter === f.value
                      ? 'bg-ink text-surface shadow-sm'
                      : 'text-ink-tertiary hover:text-ink',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Range presets */}
            <div className="flex items-center gap-1 p-0.5 rounded-[4px] border border-line bg-surface-alt">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setRange(p.value); setSelectedEventId(null) }}
                  className={[
                    'px-2.5 py-1 rounded-[3px] text-[11px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
                    range === p.value
                      ? 'bg-ink text-surface shadow-sm'
                      : 'text-ink-tertiary hover:text-ink',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Event count strip */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line-subtle">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium text-ink">{totalEvents}</span>
            <span className="font-mono text-[10px] text-ink-quaternary">
              {totalEvents === 1 ? 'event' : 'events'} in range
            </span>
          </div>
          {selectedServices.size > 0 && (
            <>
              <div className="w-px h-3 bg-line-subtle" />
              <button
                onClick={() => setSelectedServices(new Set())}
                className="font-mono text-[10px] text-ink-tertiary hover:text-ink transition-colors"
              >
                Show all services
              </button>
            </>
          )}
          {typeFilter !== 'all' && (
            <>
              <div className="w-px h-3 bg-line-subtle" />
              <button
                onClick={() => setTypeFilter('all')}
                className="font-mono text-[10px] text-ink-tertiary hover:text-ink transition-colors"
              >
                Clear type filter
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Timeline canvas ── */}
      <main className="flex-1 overflow-x-auto">
        {loading ? (
          <TimelineSkeleton />
        ) : !hasEvents ? (
          <EmptyState message="No events in this range" />
        ) : (
          <div style={{ minWidth: '640px' }}>
            {/* Time axis */}
            <TimeAxis ticks={ticks} rangeStart={rangeStart} rangeEnd={rangeEnd} />

            {/* Service lanes */}
            <div>
              {visibleServiceNames.map((svcName) => {
                const laneEvents = eventsByService.get(svcName) ?? []
                return (
                  <LaneRow
                    key={svcName}
                    service={svcName}
                    displayName={displayName(svcName)}
                    events={laneEvents}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    selectedEventId={selectedEventId}
                    onSelectEvent={setSelectedEventId}
                  />
                )
              })}
            </div>

            {/* Bottom rule */}
            <div className="h-12 border-t border-line-subtle" style={{ marginTop: '0' }} />
          </div>
        )}
      </main>
    </div>
  )
}
