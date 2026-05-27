'use client'

/**
 * Policies page — CRUD for rollout and rollback policies.
 * Route: /policies
 *
 * Rollout policy fields:
 *   strategy (canary/blue-green/ring), initial weight %, step increment,
 *   promotion window (minutes), max error rate threshold, p99 latency threshold,
 *   required gates (smoke / load / manual)
 *
 * Rollback policy fields:
 *   auto-rollback toggle, trigger conditions (error-rate-spike / p99-breach / health-check-fail),
 *   Phoenix enabled toggle, cooldown period, notification channels
 *
 * Design notes:
 * - Private ANIM_CSS injection and useMountAnim removed; use shared animate-* utilities (§7.2).
 * - All rounded-lg / rounded-[6px] → rounded-[4px] (§7.1).
 * - Toggle thumb bg-white → bg-surface (§7.5 / No-Pure-Extremes Rule).
 * - strategyColor uses system signal/ink tokens instead of raw Tailwind amber/blue/violet.
 * - DemoBanner unconditional — no real-data path yet.
 *   TODO: guard with demo flag when live data is wired.
 * - dt-pop bounce easing removed from MultiCheck checkmark (bounce is banned).
 */

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Shield, Trash2, X, Zap } from 'lucide-react'
import { DemoBanner, MonoLabel, SectionHeader } from '../../components/console/ConsolePrimitives'
import { useSearch, useNavigate } from '@/lib/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

// ─── Types ────────────────────────────────────────────────────────────────────

type Strategy         = 'canary' | 'blue-green' | 'ring'
type Gate             = 'smoke' | 'load' | 'manual'
type TriggerCondition = 'error_rate_spike' | 'p99_breach' | 'health_check_fail'
type NotifChannel     = 'slack' | 'pagerduty' | 'email'

interface RolloutPolicy {
  id: string
  name: string
  strategy: Strategy
  initialWeight: number
  stepIncrement: number
  promotionWindow: number
  maxErrorRate: number
  maxP99: number
  requiredGates: Gate[]
  appliedTo: string[]
}

interface RollbackPolicy {
  id: string
  name: string
  autoRollback: boolean
  triggerConditions: TriggerCondition[]
  phoenixEnabled: boolean
  cooldownMinutes: number
  notifChannels: NotifChannel[]
  appliedTo: string[]
}

// ─── Demo seed data ───────────────────────────────────────────────────────────

const SEED_ROLLOUT: RolloutPolicy[] = [
  {
    id: 'rol-1',
    name: 'Default Canary',
    strategy: 'canary',
    initialWeight: 5,
    stepIncrement: 10,
    promotionWindow: 30,
    maxErrorRate: 1.0,
    maxP99: 500,
    requiredGates: ['smoke'],
    appliedTo: ['api-gateway', 'auth-service'],
  },
  {
    id: 'rol-2',
    name: 'Fast Blue-Green',
    strategy: 'blue-green',
    initialWeight: 50,
    stepIncrement: 50,
    promotionWindow: 10,
    maxErrorRate: 0.5,
    maxP99: 300,
    requiredGates: ['smoke', 'load'],
    appliedTo: ['payment-service'],
  },
  {
    id: 'rol-3',
    name: 'Ring Rollout — Infra',
    strategy: 'ring',
    initialWeight: 2,
    stepIncrement: 5,
    promotionWindow: 60,
    maxErrorRate: 0.2,
    maxP99: 800,
    requiredGates: ['smoke', 'load', 'manual'],
    appliedTo: ['k8s-operator', 'infra-controller'],
  },
]

const SEED_ROLLBACK: RollbackPolicy[] = [
  {
    id: 'rbk-1',
    name: 'Standard Auto-Rollback',
    autoRollback: true,
    triggerConditions: ['error_rate_spike', 'health_check_fail'],
    phoenixEnabled: false,
    cooldownMinutes: 15,
    notifChannels: ['slack'],
    appliedTo: ['api-gateway', 'auth-service'],
  },
  {
    id: 'rbk-2',
    name: 'Phoenix Critical',
    autoRollback: true,
    triggerConditions: ['error_rate_spike', 'p99_breach', 'health_check_fail'],
    phoenixEnabled: true,
    cooldownMinutes: 5,
    notifChannels: ['slack', 'pagerduty'],
    appliedTo: ['payment-service'],
  },
  {
    id: 'rbk-3',
    name: 'Manual Rollback Only',
    autoRollback: false,
    triggerConditions: [],
    phoenixEnabled: false,
    cooldownMinutes: 60,
    notifChannels: ['email'],
    appliedTo: ['search-service'],
  },
]

const ALL_GATES: { value: Gate; label: string }[] = [
  { value: 'smoke',  label: 'Smoke tests' },
  { value: 'load',   label: 'Load tests' },
  { value: 'manual', label: 'Manual approval' },
]

const ALL_TRIGGERS: { value: TriggerCondition; label: string; desc: string }[] = [
  { value: 'error_rate_spike',  label: 'Error rate spike',    desc: '>2× baseline in 5 min window' },
  { value: 'p99_breach',        label: 'p99 latency breach',  desc: 'Exceeds policy p99 threshold' },
  { value: 'health_check_fail', label: 'Health-check fail',   desc: '3 consecutive /health failures' },
]

const ALL_CHANNELS: { value: NotifChannel; label: string }[] = [
  { value: 'slack',      label: 'Slack' },
  { value: 'pagerduty',  label: 'PagerDuty' },
  { value: 'email',      label: 'Email' },
]

const STRATEGY_OPTIONS: { value: Strategy; label: string; desc: string }[] = [
  { value: 'canary',     label: 'Canary',     desc: 'Incremental traffic split with automatic promotion gates' },
  { value: 'blue-green', label: 'Blue-Green', desc: 'Full clone; instant cutover, instant rollback' },
  { value: 'ring',       label: 'Ring',       desc: 'Progressive rings: internal → beta → 10% → 100%' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

/** Strategy badge: uses system tokens only — no raw Tailwind color palette classes. */
function strategyBadgeClass(s: Strategy): string {
  if (s === 'canary')     return 'text-primary-dark border-primary/30 bg-primary-muted'
  if (s === 'blue-green') return 'text-signal-deploy border-signal-deploy/20 bg-signal-deploy/8'
  return 'text-ink-secondary border-line bg-surface-alt'
}

// ─── Blank policy builders ────────────────────────────────────────────────────

function blankRollout(): RolloutPolicy {
  return {
    id: `rol-${uid()}`,
    name: '',
    strategy: 'canary',
    initialWeight: 5,
    stepIncrement: 10,
    promotionWindow: 30,
    maxErrorRate: 1.0,
    maxP99: 500,
    requiredGates: ['smoke'],
    appliedTo: [],
  }
}

function blankRollback(): RollbackPolicy {
  return {
    id: `rbk-${uid()}`,
    name: '',
    autoRollback: true,
    triggerConditions: ['error_rate_spike'],
    phoenixEnabled: false,
    cooldownMinutes: 15,
    notifChannels: ['slack'],
    appliedTo: [],
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Toggle switch — thumb uses bg-surface (not bg-white). */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        checked ? 'bg-ink border-ink' : 'bg-transparent border-ink-quaternary',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-surface shadow-sm',
          'transition-all duration-150 ease-out mt-[2px]',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        ].join(' ')}
      />
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] font-medium text-ink-quaternary uppercase tracking-[0.08em] mb-1.5"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        'w-full rounded-[4px] border border-line bg-surface px-2.5 py-1.5',
        'text-[13px] text-ink placeholder:text-ink-quaternary',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
        'transition-colors duration-150',
        className,
      ].join(' ')}
    />
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  unit?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={[
          'w-20 rounded-[4px] border border-line bg-surface px-2.5 py-1.5',
          'text-[13px] text-ink',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
          'transition-colors duration-150',
        ].join(' ')}
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      />
      {unit && (
        <span
          className="text-[11px] text-ink-tertiary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {unit}
        </span>
      )}
    </div>
  )
}

function MultiCheck<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string; desc?: string }[]
  selected: T[]
  onChange: (v: T[]) => void
}) {
  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer group">
          <span
            className={[
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-150',
              selected.includes(opt.value)
                ? 'bg-ink border-ink'
                : 'bg-surface border-ink-quaternary group-hover:border-ink-tertiary',
            ].join(' ')}
            onClick={() => toggle(opt.value)}
          >
            {selected.includes(opt.value) && (
              <Check size={10} strokeWidth={3} className="text-surface" />
            )}
          </span>
          <span>
            <span className="text-[13px] text-ink">{opt.label}</span>
            {opt.desc && <span className="block text-[11px] text-ink-tertiary">{opt.desc}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

// ─── Form action buttons ──────────────────────────────────────────────────────

function FormActions({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-[4px] bg-ink px-3 py-1.5 text-[12px] font-medium text-surface disabled:opacity-40 hover:opacity-80 transition-opacity duration-150"
      >
        <Check size={12} strokeWidth={2.5} />
        Save policy
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-line px-3 py-1.5 text-[12px] text-ink-secondary hover:text-ink transition-colors duration-150"
      >
        <X size={12} strokeWidth={2} />
        Cancel
      </button>
    </div>
  )
}

// ─── Rollout Policy Form ──────────────────────────────────────────────────────

function RolloutPolicyForm({
  policy,
  onChange,
  onSave,
  onCancel,
}: {
  policy: RolloutPolicy
  onChange: (p: RolloutPolicy) => void
  onSave: () => void
  onCancel: () => void
}) {
  const set = <K extends keyof RolloutPolicy>(k: K, v: RolloutPolicy[K]) =>
    onChange({ ...policy, [k]: v })

  return (
    <div className="rounded-[4px] border border-line bg-surface-alt p-5 space-y-5 animate-slide-down">
      <div>
        <FieldLabel>Policy name</FieldLabel>
        <TextInput
          value={policy.name}
          onChange={(v) => set('name', v)}
          placeholder="e.g. Default Canary"
          className="max-w-sm"
        />
      </div>

      <div>
        <FieldLabel>Deployment strategy</FieldLabel>
        <div className="flex gap-2 flex-wrap">
          {STRATEGY_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set('strategy', s.value)}
              className={[
                'rounded-[4px] border px-3 py-2 text-left transition-colors duration-150',
                policy.strategy === s.value
                  ? strategyBadgeClass(s.value) + ' font-medium'
                  : 'border-line text-ink-secondary hover:border-ink/30',
              ].join(' ')}
            >
              <div className="text-[12px] font-medium">{s.label}</div>
              <div className="text-[10px] text-ink-tertiary mt-0.5 max-w-[160px]">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-lg">
        <div><FieldLabel>Initial weight</FieldLabel><NumberInput value={policy.initialWeight} onChange={(v) => set('initialWeight', v)} min={1} max={100} unit="%" /></div>
        <div><FieldLabel>Step increment</FieldLabel><NumberInput value={policy.stepIncrement} onChange={(v) => set('stepIncrement', v)} min={1} max={100} unit="%" /></div>
        <div><FieldLabel>Promotion window</FieldLabel><NumberInput value={policy.promotionWindow} onChange={(v) => set('promotionWindow', v)} min={1} unit="min" /></div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-lg">
        <div><FieldLabel>Max error rate</FieldLabel><NumberInput value={policy.maxErrorRate} onChange={(v) => set('maxErrorRate', v)} min={0} unit="%" /></div>
        <div><FieldLabel>Max p99 latency</FieldLabel><NumberInput value={policy.maxP99} onChange={(v) => set('maxP99', v)} min={0} unit="ms" /></div>
      </div>

      <div>
        <FieldLabel>Required gates</FieldLabel>
        <MultiCheck<Gate> options={ALL_GATES} selected={policy.requiredGates} onChange={(v) => set('requiredGates', v)} />
      </div>

      <FormActions onSave={onSave} onCancel={onCancel} disabled={!policy.name.trim()} />
    </div>
  )
}

// ─── Rollback Policy Form ─────────────────────────────────────────────────────

function RollbackPolicyForm({
  policy,
  onChange,
  onSave,
  onCancel,
}: {
  policy: RollbackPolicy
  onChange: (p: RollbackPolicy) => void
  onSave: () => void
  onCancel: () => void
}) {
  const set = <K extends keyof RollbackPolicy>(k: K, v: RollbackPolicy[K]) =>
    onChange({ ...policy, [k]: v })

  return (
    <div className="rounded-[4px] border border-line bg-surface-alt p-5 space-y-5 animate-slide-down">
      <div>
        <FieldLabel>Policy name</FieldLabel>
        <TextInput
          value={policy.name}
          onChange={(v) => set('name', v)}
          placeholder="e.g. Standard Auto-Rollback"
          className="max-w-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <Toggle checked={policy.autoRollback} onChange={(v) => set('autoRollback', v)} />
        <span className="text-[13px] text-ink">Enable automatic rollback</span>
      </div>

      <div className={!policy.autoRollback ? 'opacity-40 pointer-events-none' : ''}>
        <FieldLabel>Trigger conditions</FieldLabel>
        <MultiCheck<TriggerCondition>
          options={ALL_TRIGGERS}
          selected={policy.triggerConditions}
          onChange={(v) => set('triggerConditions', v)}
        />
      </div>

      {/* Phoenix panel */}
      <div className="rounded-[4px] border border-line bg-surface p-3 flex items-start gap-3">
        <Zap size={14} strokeWidth={1.5} className="text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-ink">Phoenix mode</p>
              <p className="text-[11px] text-ink-tertiary mt-0.5">
                Titan automatically rewrites the failed commit, opens a fix PR, and re-deploys.
              </p>
            </div>
            <Toggle checked={policy.phoenixEnabled} onChange={(v) => set('phoenixEnabled', v)} />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Cooldown period</FieldLabel>
        <NumberInput
          value={policy.cooldownMinutes}
          onChange={(v) => set('cooldownMinutes', v)}
          min={1}
          unit="min"
        />
        <p className="text-[11px] text-ink-tertiary mt-1">
          Minimum time between consecutive rollbacks for the same service.
        </p>
      </div>

      <div>
        <FieldLabel>Notification channels</FieldLabel>
        <MultiCheck<NotifChannel> options={ALL_CHANNELS} selected={policy.notifChannels} onChange={(v) => set('notifChannels', v)} />
      </div>

      <FormActions onSave={onSave} onCancel={onCancel} disabled={!policy.name.trim()} />
    </div>
  )
}

// ─── Policy row — rollout ─────────────────────────────────────────────────────

function RolloutRow({
  policy,
  onEdit,
  onDelete,
}: {
  policy: RolloutPolicy
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Collapsible>
    <div className="rounded-[4px] border border-line bg-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <CollapsibleTrigger
          className="text-ink-quaternary hover:text-ink transition-colors duration-150 data-open:text-ink"
          aria-label="Toggle details"
        >
          <ChevronDown size={14} className="group-data-open:hidden" />
          <ChevronUp size={14} className="hidden group-data-open:block" />
        </CollapsibleTrigger>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-ink">{policy.name}</span>
            <span
              className={['rounded-[2px] border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em]', strategyBadgeClass(policy.strategy)].join(' ')}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {policy.strategy}
            </span>
          </div>
          <p
            className="text-[10px] text-ink-tertiary mt-0.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {policy.initialWeight}% → +{policy.stepIncrement}%/{policy.promotionWindow}min
            {' · '}err &lt;{policy.maxErrorRate}%
            {' · '}p99 &lt;{policy.maxP99}ms
          </p>
        </div>

        {policy.appliedTo.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end max-w-[220px]">
            {policy.appliedTo.slice(0, 3).map((s) => (
              <MonoLabel key={s}>{s}</MonoLabel>
            ))}
            {policy.appliedTo.length > 3 && (
              <span className="text-[10px] text-ink-tertiary">+{policy.appliedTo.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit policy"
            className="rounded-[4px] p-1.5 text-ink-tertiary hover:text-ink hover:bg-surface-alt transition-colors duration-150"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete policy"
            className="rounded-[4px] p-1.5 text-ink-tertiary hover:text-signal-danger transition-colors duration-150"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <CollapsibleContent className="border-t border-line bg-surface-alt px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-down">
        <PolicyDetailCell label="Gates" value={policy.requiredGates.length > 0 ? policy.requiredGates.join(', ') : '—'} />
        <PolicyDetailCell label="Applied to" value={policy.appliedTo.length > 0 ? policy.appliedTo.join(', ') : 'No services'} />
        <PolicyDetailCell label="Promotion window" value={`${policy.promotionWindow} min`} />
        <PolicyDetailCell label="SLO thresholds" value={`err <${policy.maxErrorRate}% · p99 <${policy.maxP99}ms`} />
      </CollapsibleContent>
    </div>
    </Collapsible>
  )
}

// ─── Policy row — rollback ────────────────────────────────────────────────────

function RollbackRow({
  policy,
  onEdit,
  onDelete,
}: {
  policy: RollbackPolicy
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Collapsible>
    <div className="rounded-[4px] border border-line bg-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <CollapsibleTrigger
          className="text-ink-quaternary hover:text-ink transition-colors duration-150 data-open:text-ink"
          aria-label="Toggle details"
        >
          <ChevronDown size={14} className="group-data-open:hidden" />
          <ChevronUp size={14} className="hidden group-data-open:block" />
        </CollapsibleTrigger>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-ink">{policy.name}</span>
            {policy.autoRollback && (
              <span
                className="rounded-[2px] border border-signal-success/30 bg-signal-success/8 px-1.5 py-0.5 text-[9px] font-medium text-signal-success uppercase tracking-[0.06em]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                auto
              </span>
            )}
            {policy.phoenixEnabled && (
              <span
                className="rounded-[2px] border border-primary/30 bg-primary-muted px-1.5 py-0.5 text-[9px] font-medium text-primary-dark uppercase tracking-[0.06em] flex items-center gap-1"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                <Zap size={8} strokeWidth={2} />
                phoenix
              </span>
            )}
          </div>
          <p
            className="text-[10px] text-ink-tertiary mt-0.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {policy.autoRollback
              ? `triggers: ${policy.triggerConditions.join(' · ') || '—'}`
              : 'manual rollback only'}
            {' · '}cooldown {policy.cooldownMinutes}min
          </p>
        </div>

        {policy.appliedTo.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end max-w-[220px]">
            {policy.appliedTo.slice(0, 3).map((s) => (
              <MonoLabel key={s}>{s}</MonoLabel>
            ))}
            {policy.appliedTo.length > 3 && (
              <span className="text-[10px] text-ink-tertiary">+{policy.appliedTo.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit policy"
            className="rounded-[4px] p-1.5 text-ink-tertiary hover:text-ink hover:bg-surface-alt transition-colors duration-150"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete policy"
            className="rounded-[4px] p-1.5 text-ink-tertiary hover:text-signal-danger transition-colors duration-150"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <CollapsibleContent className="border-t border-line bg-surface-alt px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-down">
        <PolicyDetailCell label="Notification channels" value={policy.notifChannels.length > 0 ? policy.notifChannels.join(', ') : '—'} />
        <PolicyDetailCell label="Applied to" value={policy.appliedTo.length > 0 ? policy.appliedTo.join(', ') : 'No services'} />
        <PolicyDetailCell label="Cooldown" value={`${policy.cooldownMinutes} min`} />
        <PolicyDetailCell label="Phoenix" value={policy.phoenixEnabled ? 'Enabled' : 'Disabled'} />
      </CollapsibleContent>
    </div>
    </Collapsible>
  )
}

function PolicyDetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[9px] text-ink-quaternary uppercase tracking-[0.08em] mb-1"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </p>
      <p className="text-[12px] text-ink">{value}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ActiveForm =
  | { type: 'new-rollout' }
  | { type: 'new-rollback' }
  | { type: 'edit-rollout'; id: string }
  | { type: 'edit-rollback'; id: string }
  | null

export function PoliciesPage() {
  const search = useSearch({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/policies' })
  const navigate = useNavigate({ from: '/orgs/$orgId/projects/$projectId/policies' })

  const activeTab = search.tab as 'rollout' | 'rollback'
  const setActiveTab = (t: 'rollout' | 'rollback') =>
    navigate({ search: (prev) => ({ ...prev, tab: t }) })

  const [rolloutPolicies,  setRolloutPolicies]  = useState<RolloutPolicy[]>(SEED_ROLLOUT)
  const [rollbackPolicies, setRollbackPolicies] = useState<RollbackPolicy[]>(SEED_ROLLBACK)
  const [activeForm,       setActiveForm]       = useState<ActiveForm>(null)
  const [draftRollout,     setDraftRollout]     = useState<RolloutPolicy>(blankRollout)
  const [draftRollback,    setDraftRollback]    = useState<RollbackPolicy>(blankRollback)

  // ── Rollout handlers ──
  const startNewRollout = () => { setDraftRollout(blankRollout()); setActiveForm({ type: 'new-rollout' }) }
  const startEditRollout = (id: string) => {
    const p = rolloutPolicies.find((x) => x.id === id)
    if (!p) return
    setDraftRollout({ ...p })
    setActiveForm({ type: 'edit-rollout', id })
  }
  const saveRollout = () => {
    if (!draftRollout.name.trim()) return
    if (activeForm?.type === 'edit-rollout') {
      setRolloutPolicies((prev) => prev.map((p) => (p.id === draftRollout.id ? draftRollout : p)))
    } else {
      setRolloutPolicies((prev) => [...prev, draftRollout])
    }
    setActiveForm(null)
  }
  const deleteRollout = (id: string) => setRolloutPolicies((prev) => prev.filter((p) => p.id !== id))

  // ── Rollback handlers ──
  const startNewRollback = () => { setDraftRollback(blankRollback()); setActiveForm({ type: 'new-rollback' }) }
  const startEditRollback = (id: string) => {
    const p = rollbackPolicies.find((x) => x.id === id)
    if (!p) return
    setDraftRollback({ ...p })
    setActiveForm({ type: 'edit-rollback', id })
  }
  const saveRollback = () => {
    if (!draftRollback.name.trim()) return
    if (activeForm?.type === 'edit-rollback') {
      setRollbackPolicies((prev) => prev.map((p) => (p.id === draftRollback.id ? draftRollback : p)))
    } else {
      setRollbackPolicies((prev) => [...prev, draftRollback])
    }
    setActiveForm(null)
  }
  const deleteRollback = (id: string) => setRollbackPolicies((prev) => prev.filter((p) => p.id !== id))

  const isRolloutForm  = activeForm?.type === 'new-rollout'  || activeForm?.type === 'edit-rollout'
  const isRollbackForm = activeForm?.type === 'new-rollback' || activeForm?.type === 'edit-rollback'

  return (
    <div className="min-h-full">
      {/* TODO: guard with demo flag */}
      <DemoBanner />

      <div className="px-8 py-10 animate-fade-up">
        {/* Page header */}
        <div className="mb-8 flex items-start gap-3">
          <Shield size={18} strokeWidth={1.5} className="text-ink-tertiary mt-0.5 shrink-0" />
          <div>
            <h1
              className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
            >
              Policies
            </h1>
            <p className="text-[12px] text-ink-tertiary">
              Define rollout strategies and rollback triggers applied to your services.
            </p>
          </div>
        </div>

        {/* ─── Tab bar ─────────────────────────────────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'rollout' | 'rollback')}
          className="mb-8"
        >
          <TabsList variant="line" className="w-full justify-start rounded-none border-b border-line bg-transparent pb-0">
            <TabsTrigger value="rollout">Rollout policies</TabsTrigger>
            <TabsTrigger value="rollback">Rollback policies</TabsTrigger>
          </TabsList>

          {/* ─── Rollout Policies ─────────────────────────────────────────── */}
          <TabsContent value="rollout">
        <section className="mb-10 mt-6">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader>
              Rollout Policies
              <span className="ml-2 text-ink-quaternary font-normal normal-case tracking-normal">
                ({rolloutPolicies.length})
              </span>
            </SectionHeader>
            {!isRolloutForm && (
              <button
                type="button"
                onClick={startNewRollout}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-line px-2.5 py-1 text-[11px] text-ink-secondary hover:text-ink hover:border-ink/30 transition-colors duration-150"
                style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              >
                <Plus size={11} strokeWidth={2} />
                New rollout policy
              </button>
            )}
          </div>

          <div className="space-y-2">
            {rolloutPolicies.map((p) =>
              activeForm?.type === 'edit-rollout' && activeForm.id === p.id ? (
                <RolloutPolicyForm
                  key={p.id}
                  policy={draftRollout}
                  onChange={setDraftRollout}
                  onSave={saveRollout}
                  onCancel={() => setActiveForm(null)}
                />
              ) : (
                <RolloutRow
                  key={p.id}
                  policy={p}
                  onEdit={() => startEditRollout(p.id)}
                  onDelete={() => deleteRollout(p.id)}
                />
              )
            )}

            {activeForm?.type === 'new-rollout' && (
              <RolloutPolicyForm
                policy={draftRollout}
                onChange={setDraftRollout}
                onSave={saveRollout}
                onCancel={() => setActiveForm(null)}
              />
            )}

            {rolloutPolicies.length === 0 && !isRolloutForm && (
              <EmptyPoliciesState onAdd={startNewRollout} noun="rollout" />
            )}
          </div>
        </section>
          </TabsContent>

          {/* ─── Rollback Policies ──────────────────────────────────────────── */}
          <TabsContent value="rollback">
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader>
              Rollback Policies
              <span className="ml-2 text-ink-quaternary font-normal normal-case tracking-normal">
                ({rollbackPolicies.length})
              </span>
            </SectionHeader>
            {!isRollbackForm && (
              <button
                type="button"
                onClick={startNewRollback}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-line px-2.5 py-1 text-[11px] text-ink-secondary hover:text-ink hover:border-ink/30 transition-colors duration-150"
                style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              >
                <Plus size={11} strokeWidth={2} />
                New rollback policy
              </button>
            )}
          </div>

          <div className="space-y-2">
            {rollbackPolicies.map((p) =>
              activeForm?.type === 'edit-rollback' && activeForm.id === p.id ? (
                <RollbackPolicyForm
                  key={p.id}
                  policy={draftRollback}
                  onChange={setDraftRollback}
                  onSave={saveRollback}
                  onCancel={() => setActiveForm(null)}
                />
              ) : (
                <RollbackRow
                  key={p.id}
                  policy={p}
                  onEdit={() => startEditRollback(p.id)}
                  onDelete={() => deleteRollback(p.id)}
                />
              )
            )}

            {activeForm?.type === 'new-rollback' && (
              <RollbackPolicyForm
                policy={draftRollback}
                onChange={setDraftRollback}
                onSave={saveRollback}
                onCancel={() => setActiveForm(null)}
              />
            )}

            {rollbackPolicies.length === 0 && !isRollbackForm && (
              <EmptyPoliciesState onAdd={startNewRollback} noun="rollback" />
            )}
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function EmptyPoliciesState({ onAdd, noun }: { onAdd: () => void; noun: string }) {
  return (
    <div className="rounded-[4px] border border-dashed border-line px-4 py-8 text-center animate-fade-in">
      <p className="text-[12px] text-ink-tertiary mb-2">No {noun} policies yet.</p>
      <button
        type="button"
        onClick={onAdd}
        className="text-[12px] text-ink underline underline-offset-2 hover:no-underline transition-all duration-150"
      >
        Create your first {noun} policy
      </button>
    </div>
  )
}
