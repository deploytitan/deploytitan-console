'use client'

/**
 * BillingPage — workspace-level billing and subscriptions.
 * Route: /billing
 *
 * Model:
 *   - One user can own multiple Workspaces (billing accounts)
 *   - Each Workspace has exactly one active subscription plan
 *   - Plans gate features and resource limits; expansion via add-ons
 *   - No credits, no overages — fixed predictable pricing
 *   - Polar is the payment processor
 *
 * Layout:
 *   Left: workspace list (compact rows)
 *   Right: detail panel for selected workspace, with tabs:
 *          Plans | Overview | Add-ons | Payment | Invoices | Usage
 */

import { useState, useEffect } from 'react'
import { useSearch, useNavigate } from '@/lib/navigation'
import {
  Plus,
  CreditCard,
  Building2,
  Zap,
  Receipt,
  CheckCircle,
  X,
  ChevronRight,
  ChevronDown,
  Unlink,
  Link2,
  Check,
  AlertCircle,
  LayoutGrid,
  Package,
  ShieldCheck,
  Minus,
} from 'lucide-react'
import { useBillingProducts } from '../../hooks/useBillingProducts'
import { useOrgList } from '../../hooks/useOrgList'
import { useProjectList } from '../../hooks/useProjectList'
import type { BillingProduct, AddOn, BillingUsage } from '../../lib/billing'
import { CANONICAL_PLANS, CANONICAL_ADDONS } from '../../lib/billing'
import type { PlanTier } from '../../lib/billing'
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

function formatLimit(n: number | null): string {
  if (n === null) return 'Unlimited'
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SubStatus = 'active' | 'past_due' | 'canceled' | 'none'
type InvoiceStatus = 'paid' | 'open' | 'overdue'
type DetailTab = 'plans' | 'overview' | 'addons' | 'payment' | 'invoices' | 'usage'

interface ConnectedTeam {
  id: string
  teamName: string
  connectedAt: string
}

interface Invoice {
  id: string
  date: string
  description: string
  amount: number // cents
  status: InvoiceStatus
}

interface WorkspaceAccount {
  id: string
  name: string
  planTier: PlanTier | null
  status: SubStatus
  renewsAt: string | null
  servicesUsed: number
  orgsUsed: number
  projectsUsed: number
  seatsUsed: number
  connectedTeams: ConnectedTeam[]
  invoices: Invoice[]
}

// ── Demo fixtures ─────────────────────────────────────────────────────────────

const DEMO_USAGE: BillingUsage = {
  period: { start: '2026-05-01', end: '2026-05-31' },
  services: { used: 37, limit: 100 },
  organizations: { used: 2, limit: 5 },
  projects: { used: 11, limit: 25 },
  seats: { used: 18, limit: 50 },
  environments: { used: 6, limit: 10 },
  deploymentsThisPeriod: 247,
  rollbacksThisPeriod: 3,
  incidentsAutoResolved: 11,
  highRiskPrsFlagged: 34,
  policyChecksRun: 1204,
}

const DEMO_WORKSPACES: WorkspaceAccount[] = [
  {
    id: 'ws_1',
    name: 'Acme Corp',
    planTier: 'growth',
    status: 'active',
    renewsAt: '2026-06-13',
    servicesUsed: 37,
    orgsUsed: 2,
    projectsUsed: 11,
    seatsUsed: 18,
    connectedTeams: [
      { id: 'ct1', teamName: 'Payments', connectedAt: '2026-03-01' },
      { id: 'ct2', teamName: 'Platform', connectedAt: '2026-04-10' },
    ],
    invoices: [
      { id: 'inv_3', date: '2026-05-01', description: 'Growth · May 2026', amount: 49900, status: 'paid' },
      { id: 'inv_2', date: '2026-04-01', description: 'Growth · Apr 2026', amount: 49900, status: 'paid' },
      { id: 'inv_1', date: '2026-03-01', description: 'Growth · Mar 2026', amount: 49900, status: 'paid' },
    ],
  },
  {
    id: 'ws_2',
    name: 'Side projects',
    planTier: 'starter',
    status: 'active',
    renewsAt: '2026-06-20',
    servicesUsed: 3,
    orgsUsed: 1,
    projectsUsed: 2,
    seatsUsed: 2,
    connectedTeams: [
      { id: 'ct3', teamName: 'Personal', connectedAt: '2026-05-01' },
    ],
    invoices: [
      { id: 'inv_s1', date: '2026-05-20', description: 'Starter · May 2026', amount: 4900, status: 'paid' },
    ],
  },
]

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {children}
    </p>
  )
}

function SubStatusDot({ status }: { status: SubStatus }) {
  const colors: Record<SubStatus, string> = {
    active:   'bg-signal-success',
    past_due: 'bg-signal-warning',
    canceled: 'bg-line',
    none:     'bg-line',
  }
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 ${colors[status]}`}
      style={{ borderRadius: '1px' }}
      aria-hidden="true"
    />
  )
}

function PlanBadge({ tier }: { tier: PlanTier | null }) {
  if (!tier) return null
  const labels: Record<PlanTier, string> = {
    starter: 'Starter',
    growth: 'Growth',
    scale: 'Scale',
    enterprise: 'Enterprise',
  }
  return (
    <span
      className="border border-line bg-surface-alt px-1.5 py-px text-ink-tertiary"
      style={{
        borderRadius: '1px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {labels[tier]}
    </span>
  )
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    paid:    'border-signal-success/25 bg-signal-success/8 text-signal-success',
    open:    'border-signal-warning/30 bg-signal-warning/8 text-signal-warning',
    overdue: 'border-signal-danger/30 bg-signal-danger/8 text-signal-danger',
  }
  return (
    <span
      className={`border px-1.5 py-px ${styles[status]}`}
      style={{
        borderRadius: '1px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  )
}

/** Thin progress bar used across OverviewTab and UsageTab */
function UsageBar({
  used,
  limit,
  className = '',
}: {
  used: number
  limit: number | null
  className?: string
}) {
  const pct = limit === null ? 0 : Math.min(100, (used / limit) * 100)
  const isHigh = limit !== null && pct >= 80
  return (
    <div className={`h-1.5 w-full overflow-hidden bg-line ${className}`} style={{ borderRadius: '1px' }}>
      {limit !== null && (
        <div
          className={`h-full transition-all ${isHigh ? 'bg-signal-warning' : 'bg-primary'}`}
          style={{
            width: `${pct}%`,
            borderRadius: '1px',
            transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      )}
    </div>
  )
}

// ── Create workspace form ──────────────────────────────────────────────────────

const CHECKOUT_LINK = 'https://buy.polar.sh/polar_cl_IMYMAqCELPYNnSKQcZGrZGbndr578X6SQs6oU01P8cf'

function CreateWorkspaceForm({
  onCancel,
  onCreated,
  products,
}: {
  onCancel: () => void
  onCreated: (workspace: WorkspaceAccount) => void
  products: BillingProduct[]
}) {
  const [name, setName] = useState('')
  const [selectedTier, setSelectedTier] = useState<PlanTier>(products[0]?.tier ?? 'starter')
  const [checkingOut, setCheckingOut] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const selectable = products.filter((p) => !p.isCustom)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !selectedTier) return

    const plan = selectable.find((p) => p.tier === selectedTier)
    if (!plan) return

    setCheckingOut(true)
    try {
      const checkout = await PolarEmbedCheckout.create(CHECKOUT_LINK, { theme: 'light' })
      checkout.addEventListener('success', () => {
        const newWorkspace: WorkspaceAccount = {
          id: `ws_${Math.random().toString(36).slice(2)}`,
          name: name.trim(),
          planTier: selectedTier,
          status: 'active',
          renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          servicesUsed: 0,
          orgsUsed: 0,
          projectsUsed: 0,
          seatsUsed: 0,
          connectedTeams: [],
          invoices: [],
        }
        onCreated(newWorkspace)
      })
      checkout.addEventListener('close', () => setCheckingOut(false))
    } catch {
      setCheckingOut(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-line bg-surface-alt p-5 space-y-5"
      style={{ borderRadius: '2px' }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        New workspace
      </p>

      {/* Name */}
      <div>
        <label htmlFor="ws-name" className="mb-1 block text-[11px] font-medium text-ink-secondary">
          Workspace name
        </label>
        <input
          id="ws-name"
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Corp, Side projects"
          className="w-full border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/40"
          style={{ borderRadius: '2px' }}
        />
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-medium text-ink-secondary">Billing cycle</p>
        <div className="flex border border-line overflow-hidden" style={{ borderRadius: '2px' }}>
          {(['monthly', 'annual'] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              className={[
                'px-3 py-1 text-[11px] font-medium transition-colors',
                billingCycle === cycle
                  ? 'bg-ink text-surface'
                  : 'text-ink-secondary hover:bg-surface-alt',
              ].join(' ')}
            >
              {cycle === 'monthly' ? 'Monthly' : 'Annual (save 20%)'}
            </button>
          ))}
        </div>
      </div>

      {/* Plan selection */}
      <div>
        <p className="mb-2 text-[11px] font-medium text-ink-secondary">Plan</p>
        <div className="space-y-2">
          {selectable.map((plan) => {
            const selected = selectedTier === plan.tier
            const price = billingCycle === 'annual' && plan.priceAnnual
              ? Math.round(plan.priceAnnual / 12)
              : plan.priceMonthly
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedTier(plan.tier)}
                className={[
                  'flex w-full items-start gap-3 border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                  selected
                    ? 'border-ink bg-surface'
                    : 'border-line bg-surface hover:border-primary/30',
                ].join(' ')}
                style={{ borderRadius: '2px' }}
              >
                <span
                  className={[
                    'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors',
                    selected ? 'border-ink bg-ink' : 'border-line',
                  ].join(' ')}
                  style={{ borderRadius: '2px' }}
                  aria-hidden="true"
                >
                  {selected && <Check size={9} className="text-surface" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-ink">{plan.name}</span>
                    {price != null && (
                      <span className="text-[11px] text-ink-tertiary">
                        {formatCents(price)}<span className="text-[10px]">/mo</span>
                      </span>
                    )}
                    {plan.isHighlighted && (
                      <span
                        className="border border-primary/30 px-1 py-px text-primary-dark"
                        style={{
                          borderRadius: '1px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '8px',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-tertiary">
                    {formatLimit(plan.limits.services)} services · {formatLimit(plan.limits.organizations)} orgs · {formatLimit(plan.limits.seats)} seats
                  </p>
                </div>
              </button>
            )
          })}

          {/* Enterprise option */}
          <div
            className="flex items-center justify-between border border-dashed border-line px-4 py-3"
            style={{ borderRadius: '2px' }}
          >
            <div>
              <p className="text-[13px] font-medium text-ink">Enterprise</p>
              <p className="text-[11px] text-ink-tertiary">For regulated and mission-critical systems</p>
            </div>
            <a
              href="mailto:sales@deploytitan.com"
              className="shrink-0 text-[11px] text-ink-tertiary underline underline-offset-2 hover:text-ink transition-colors"
            >
              Contact sales
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!name.trim() || !selectedTier || checkingOut}
          className="rounded-[2px] bg-ink px-4 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        >
          {checkingOut ? 'Opening checkout…' : 'Continue to payment'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Plans tab — comparison table ──────────────────────────────────────────────

type FeatureRowDef =
  | { kind: 'group'; label: string }
  | { kind: 'limit'; label: string; key: keyof import('../../lib/billing').PlanLimits; format?: (v: number | null) => string }
  | { kind: 'feature'; label: string; key: keyof import('../../lib/billing').PlanFeatures; note?: string }

const COMPARISON_ROWS: FeatureRowDef[] = [
  { kind: 'group', label: 'Platform limits' },
  { kind: 'limit', label: 'Services', key: 'services' },
  { kind: 'limit', label: 'Organizations', key: 'organizations' },
  { kind: 'limit', label: 'Projects', key: 'projects' },
  { kind: 'limit', label: 'Team seats', key: 'seats' },
  { kind: 'limit', label: 'Environments', key: 'environments' },
  { kind: 'limit', label: 'Audit retention', key: 'retentionDays', format: (v) => v === null ? 'Unlimited' : `${v} days` },

  { kind: 'group', label: 'Core products' },
  { kind: 'feature', label: 'Titan Rollouts', key: 'titanRollouts' },
  { kind: 'feature', label: 'Advanced rollouts', key: 'titanRolloutsAdvanced', note: 'Cohort, DAG, dependency-aware' },
  { kind: 'feature', label: 'Titan Shield', key: 'titanShield' },
  { kind: 'feature', label: 'Advanced Shield', key: 'titanShieldAdvanced', note: 'Auto rollback, anomaly triggers' },
  { kind: 'feature', label: 'Titan Foresight (lite)', key: 'titanForesightLite', note: 'Impact analysis, blast radius' },

  { kind: 'group', label: 'Orchestration' },
  { kind: 'feature', label: 'DAG release coordination', key: 'dagReleaseCoordination' },
  { kind: 'feature', label: 'Cohort routing', key: 'cohortRouting' },
  { kind: 'feature', label: 'Multi-env promotion', key: 'multiEnvPromotion' },
  { kind: 'feature', label: 'Dependency-aware releases', key: 'dependencyAwareReleases' },
  { kind: 'feature', label: 'Automated rollback policies', key: 'automatedRollbackPolicies' },
  { kind: 'feature', label: 'Deployment freeze windows', key: 'deploymentFreezeWindows' },

  { kind: 'group', label: 'Governance' },
  { kind: 'feature', label: 'Deployment approvals', key: 'approvals' },
  { kind: 'feature', label: 'Release coordination', key: 'releaseCoordination' },
  { kind: 'feature', label: 'Advanced RBAC', key: 'advancedRbac' },
  { kind: 'feature', label: 'Custom policy engine', key: 'customPolicyEngine' },
  { kind: 'feature', label: 'Compliance reporting', key: 'complianceReporting' },
  { kind: 'feature', label: 'SSO / SAML', key: 'ssoSaml' },

  { kind: 'group', label: 'Integrations' },
  { kind: 'feature', label: 'GitHub', key: 'githubIntegration' },
  { kind: 'feature', label: 'OpenTelemetry / Datadog / Grafana', key: 'otelDatadog' },
  { kind: 'feature', label: 'Slack alerts', key: 'slackAlerts' },

  { kind: 'group', label: 'Support' },
  { kind: 'feature', label: 'Support tier', key: 'supportTier' },
  { kind: 'feature', label: 'SLA', key: 'sla' },
]

function FeatureCell({ plan, row }: { plan: BillingProduct; row: FeatureRowDef }) {
  if (row.kind === 'group') return null

  if (row.kind === 'limit') {
    const val = plan.limits[row.key] as number | null
    const formatted = row.format ? row.format(val) : formatLimit(val)
    return (
      <span
        className="text-[12px] text-ink"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {formatted}
      </span>
    )
  }

  // feature row
  const val = plan.features[row.key]

  if (typeof val === 'boolean') {
    return val
      ? <Check size={13} className="text-signal-success" strokeWidth={2.5} />
      : <Minus size={13} className="text-ink-quaternary/50" strokeWidth={1.5} />
  }

  if (typeof val === 'string' && val) {
    return (
      <span
        className="text-[11px] text-ink capitalize"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {val}
      </span>
    )
  }

  return <Minus size={13} className="text-ink-quaternary/50" strokeWidth={1.5} />
}

function PlansTab({
  currentTier,
  products,
  isLoading,
  isError,
}: {
  currentTier: PlanTier | null
  products: BillingProduct[]
  isLoading: boolean
  isError: boolean
}) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const displayPlans = products.filter((p) => !p.isCustom)

  return (
    <div className="space-y-6">
      {/* Header + cycle toggle */}
      <div className="flex items-end justify-between">
        <div>
          <p
            className="text-ink-quaternary mb-1 uppercase tracking-widest"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}
          >
            Subscription plans
          </p>
          <p className="text-ink text-sm font-medium">
            Fixed pricing. No credits. No overages.
          </p>
        </div>
        <div className="flex border border-line overflow-hidden shrink-0" style={{ borderRadius: '2px' }}>
          {(['monthly', 'annual'] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              className={[
                'px-3 py-1 text-[11px] font-medium transition-colors',
                billingCycle === cycle
                  ? 'bg-ink text-surface'
                  : 'text-ink-secondary hover:bg-surface-alt',
              ].join(' ')}
            >
              {cycle === 'monthly' ? 'Monthly' : 'Annual −20%'}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div
          className="flex items-center gap-2.5 border border-signal-danger/20 bg-signal-danger/5 px-4 py-3"
          style={{ borderRadius: '2px' }}
        >
          <AlertCircle size={13} className="shrink-0 text-signal-danger" />
          <p className="text-signal-danger text-xs">
            Could not load plans. Showing default pricing.
          </p>
        </div>
      )}

      {/* Comparison table */}
      <div className="border border-line overflow-hidden" style={{ borderRadius: '2px' }}>
        {/* Sticky column headers */}
        <div
          className="grid border-b border-line bg-surface-alt sticky top-0 z-10"
          style={{ gridTemplateColumns: `220px repeat(${isLoading ? 3 : displayPlans.length}, 1fr)` }}
        >
          <div className="px-5 py-3" />
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border-l border-line px-5 py-3">
                  <div className="h-4 w-20 animate-pulse rounded-sm bg-line" />
                </div>
              ))
            : displayPlans.map((plan) => {
                const price = billingCycle === 'annual' && plan.priceAnnual
                  ? Math.round(plan.priceAnnual / 12)
                  : plan.priceMonthly
                const isCurrent = plan.tier === currentTier

                return (
                  <div
                    key={plan.id}
                    className={[
                      'border-l border-line px-5 py-3',
                      plan.isHighlighted ? 'bg-primary-muted/40' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p
                        className="text-ink-quaternary uppercase tracking-widest font-medium"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px' }}
                      >
                        {plan.name}
                      </p>
                      {isCurrent && (
                        <span
                          className="border border-signal-success/30 bg-signal-success/8 px-1 py-px text-signal-success"
                          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '8px', borderRadius: '1px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        >
                          Current
                        </span>
                      )}
                      {plan.isHighlighted && !isCurrent && (
                        <span
                          className="border border-primary/30 px-1 py-px text-primary-dark"
                          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '8px', borderRadius: '1px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        >
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-ink text-base font-semibold leading-none" style={{ letterSpacing: '-0.01em' }}>
                      {price != null ? formatCents(price) : 'Custom'}
                      {price != null && <span className="text-xs text-ink-tertiary font-normal ml-0.5">/mo</span>}
                    </p>
                    {billingCycle === 'annual' && plan.annualSavingsPct && (
                      <p
                        className="mt-0.5 text-[10px] text-primary-dark"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        billed annually
                      </p>
                    )}
                  </div>
                )
              })}
        </div>

        {/* Feature rows */}
        {isLoading ? (
          <div className="px-5 py-8 text-center">
            <div className="h-3 w-48 animate-pulse rounded-sm bg-line mx-auto" />
          </div>
        ) : (
          COMPARISON_ROWS.map((row, rowIdx) => {
            if (row.kind === 'group') {
              return (
                <div
                  key={row.label}
                  className={[
                    'grid border-b border-line bg-surface-alt',
                    rowIdx > 0 ? 'border-t border-line' : '',
                  ].join(' ')}
                  style={{ gridTemplateColumns: `220px repeat(${displayPlans.length}, 1fr)` }}
                >
                  <div className="px-5 py-2 col-span-full">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-quaternary"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {row.label}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={row.label}
                className="grid border-b border-line-subtle last:border-b-0 hover:bg-surface-alt/40 transition-colors"
                style={{ gridTemplateColumns: `220px repeat(${displayPlans.length}, 1fr)` }}
              >
                {/* Row label */}
                <div className="flex flex-col justify-center px-5 py-2.5">
                  <span className="text-[12px] text-ink-tertiary">{row.label}</span>
                  {'note' in row && row.note && (
                    <span className="mt-0.5 text-[10px] text-ink-quaternary">{row.note}</span>
                  )}
                </div>
                {/* Value cells */}
                {displayPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={[
                      'flex items-center border-l border-line-subtle px-5 py-2.5',
                      plan.isHighlighted ? 'bg-primary-muted/20' : '',
                    ].join(' ')}
                  >
                    <FeatureCell plan={plan} row={row} />
                  </div>
                ))}
              </div>
            )
          })
        )}

        {/* CTA row */}
        {!isLoading && (
          <div
            className="grid border-t border-line bg-surface-alt"
            style={{ gridTemplateColumns: `220px repeat(${displayPlans.length}, 1fr)` }}
          >
            <div className="px-5 py-4" />
            {displayPlans.map((plan) => {
              const isCurrent = plan.tier === currentTier
              return (
                <div
                  key={plan.id}
                  className={[
                    'border-l border-line px-5 py-4',
                    plan.isHighlighted ? 'bg-primary-muted/40' : '',
                  ].join(' ')}
                >
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full inline-flex cursor-default items-center justify-center border border-line px-4 py-2 text-xs font-medium text-ink-tertiary opacity-50"
                      style={{ borderRadius: '2px' }}
                    >
                      Current plan
                    </button>
                  ) : (
                    <PurchaseButton isHighlighted={plan.isHighlighted} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Enterprise block */}
      <div
        className="flex flex-col items-start justify-between gap-5 border border-line bg-surface-alt/40 px-6 py-5 sm:flex-row sm:items-center"
        style={{ borderRadius: '2px' }}
      >
        <div>
          <p className="text-ink mb-1 text-sm font-semibold">Enterprise</p>
          <p className="text-ink-tertiary max-w-md text-xs leading-relaxed">
            Unlimited services and organizations. SSO, custom policy engine, compliance reporting, dedicated support, on-prem controller, and SLA guarantees.
          </p>
        </div>
        <a
          href="mailto:sales@deploytitan.com"
          className="shrink-0 inline-flex items-center gap-2 border border-line px-5 py-2.5 text-xs font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary-dark"
          style={{ borderRadius: '2px' }}
        >
          Book a call
        </a>
      </div>

      {/* Fine print */}
      <p
        className="text-ink-quaternary text-center"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}
      >
        Fixed monthly pricing · Annual plans billed upfront · No per-deployment charges
      </p>
    </div>
  )
}

// ── Polar purchase button ──────────────────────────────────────────────────────

function PurchaseButton({ isHighlighted }: { isHighlighted: boolean }) {
  const [checkoutInstance, setCheckoutInstance] = useState<PolarEmbedCheckout | null>(null)

  useEffect(() => {
    return () => { checkoutInstance?.close() }
  }, [checkoutInstance])

  const handleCheckout = async () => {
    try {
      const checkout = await PolarEmbedCheckout.create(CHECKOUT_LINK, { theme: 'light' })
      setCheckoutInstance(checkout)
      checkout.addEventListener('close', () => setCheckoutInstance(null))
    } catch (err) {
      console.error('Failed to open checkout', err)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      className={[
        'w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isHighlighted
          ? 'bg-ink text-surface hover:bg-ink-secondary'
          : 'border border-line text-ink hover:border-primary/40 hover:bg-primary-muted',
      ].join(' ')}
      style={{ borderRadius: '2px' }}
    >
      Get started
    </button>
  )
}

// ── Detail tabs config ─────────────────────────────────────────────────────────

const DETAIL_TABS: { id: DetailTab; label: string; Icon: React.ElementType }[] = [
  { id: 'plans',    label: 'Plans',    Icon: LayoutGrid },
  { id: 'overview', label: 'Overview', Icon: Building2 },
  { id: 'addons',   label: 'Add-ons',  Icon: Package },
  { id: 'payment',  label: 'Payment',  Icon: CreditCard },
  { id: 'invoices', label: 'Invoices', Icon: Receipt },
  { id: 'usage',    label: 'Usage',    Icon: Zap },
]

// ── Detail: Overview ──────────────────────────────────────────────────────────

function OverviewTab({
  account,
  plan,
}: {
  account: WorkspaceAccount
  plan: BillingProduct | undefined
}) {
  const [connectTeamId, setConnectTeamId] = useState<string | null>(null)
  const [connectProjectId, setConnectProjectId] = useState<string | null>(null)
  const [showConnectForm, setShowConnectForm] = useState(false)

  const { orgs } = useOrgList()
  const { projects, isLoading: projectsLoading } = useProjectList(connectTeamId)

  const selectedTeam = orgs.find((o) => o.workosOrgId === connectTeamId)
  const selectedProject = projects.find((p) => p.id === connectProjectId)

  const alreadyConnected = (teamId: string) =>
    account.connectedTeams.some((ct) => ct.id === teamId)

  const handleConnect = () => {
    if (!selectedTeam || !selectedProject) return
    alert(`Connect ${selectedTeam.name} to this workspace (not wired in demo)`)
    setShowConnectForm(false)
    setConnectTeamId(null)
    setConnectProjectId(null)
  }

  const usageItems = plan ? [
    { label: 'Services',      used: account.servicesUsed,  limit: plan.limits.services },
    { label: 'Organizations', used: account.orgsUsed,      limit: plan.limits.organizations },
    { label: 'Projects',      used: account.projectsUsed,  limit: plan.limits.projects },
    { label: 'Seats',         used: account.seatsUsed,     limit: plan.limits.seats },
  ] : []

  return (
    <div className="space-y-8">
      {/* Subscription */}
      <section>
        <SectionLabel>Subscription</SectionLabel>
        <div className="border border-line" style={{ borderRadius: '2px' }}>
          <div className="flex items-center gap-2.5 border-b border-line bg-surface-alt px-5 py-3">
            <SubStatusDot status={account.status} />
            <p
              className="text-[10px] uppercase tracking-[0.08em] text-ink-secondary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {account.status === 'active' ? 'Active subscription' : account.status.replace('_', ' ')}
            </p>
          </div>
          {[
            { label: 'Workspace',   value: account.name },
            { label: 'Plan',        value: account.planTier ? account.planTier.charAt(0).toUpperCase() + account.planTier.slice(1) : '—' },
            { label: 'Renews',      value: account.renewsAt ?? '—' },
          ].map((row, i) => (
            <div
              key={row.label}
              className={[
                'flex items-center justify-between px-5 py-3',
                i > 0 ? 'border-t border-line-subtle' : '',
              ].join(' ')}
            >
              <span className="text-[12px] text-ink-tertiary">{row.label}</span>
              <span
                className="text-[12px] text-ink"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Resource usage */}
      {usageItems.length > 0 && (
        <section>
          <SectionLabel>Usage this period</SectionLabel>
          <div className="border border-line divide-y divide-line-subtle overflow-hidden" style={{ borderRadius: '2px' }}>
            {usageItems.map((item) => {
              const pct = item.limit != null ? Math.min(100, (item.used / item.limit) * 100) : 0
              const isHigh = item.limit != null && pct >= 80
              return (
                <div key={item.label} className="flex items-center gap-4 px-5 py-3 bg-surface">
                  <span className="w-28 shrink-0 text-[12px] text-ink-tertiary">{item.label}</span>
                  <div className="flex-1 min-w-0">
                    <UsageBar used={item.used} limit={item.limit} />
                  </div>
                  <span
                    className={[
                      'shrink-0 text-[11px]',
                      isHigh ? 'text-signal-warning' : 'text-ink',
                    ].join(' ')}
                    style={{ fontFamily: 'JetBrains Mono, monospace', minWidth: '5rem', textAlign: 'right' }}
                  >
                    {item.used} / {formatLimit(item.limit)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Connected teams */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Connected teams</SectionLabel>
          {!showConnectForm && (
            <button
              onClick={() => setShowConnectForm(true)}
              className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              <Link2 size={11} />
              Connect
            </button>
          )}
        </div>

        {showConnectForm && (
          <div
            className="mb-3 border border-primary/20 bg-primary-muted/30 px-4 py-4 space-y-3"
            style={{ borderRadius: '2px' }}
          >
            <p className="text-[12px] font-medium text-ink">Connect a team</p>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-[0.08em] text-ink-quaternary font-mono">
                Team
              </label>
              <div className="relative">
                <select
                  value={connectTeamId ?? ''}
                  onChange={(e) => {
                    setConnectTeamId(e.target.value || null)
                    setConnectProjectId(null)
                  }}
                  className="w-full appearance-none border border-line bg-surface px-3 py-2 pr-8 text-[12px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                  style={{ borderRadius: '2px' }}
                >
                  <option value="">Select team…</option>
                  {orgs.map((o) => (
                    <option key={o.workosOrgId} value={o.workosOrgId}>{o.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-quaternary" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-[0.08em] text-ink-quaternary font-mono">
                Project
              </label>
              <div className="relative">
                <select
                  value={connectProjectId ?? ''}
                  onChange={(e) => setConnectProjectId(e.target.value || null)}
                  disabled={!connectTeamId || projectsLoading}
                  className="w-full appearance-none border border-line bg-surface px-3 py-2 pr-8 text-[12px] text-ink disabled:text-ink-quaternary disabled:bg-surface-alt focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                  style={{ borderRadius: '2px' }}
                >
                  <option value="">
                    {!connectTeamId ? 'Select a team first…' : projectsLoading ? 'Loading…' : projects.length === 0 ? 'No projects' : 'Select project…'}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} disabled={alreadyConnected(p.id)}>
                      {p.name}{alreadyConnected(p.id) ? ' (already connected)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-quaternary" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleConnect}
                disabled={!connectTeamId || !connectProjectId}
                className="inline-flex items-center gap-1.5 bg-ink px-4 py-2 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ borderRadius: '2px' }}
              >
                <Link2 size={12} />
                Connect team
              </button>
              <button
                onClick={() => { setShowConnectForm(false); setConnectTeamId(null); setConnectProjectId(null) }}
                className="px-3 py-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {account.connectedTeams.length > 0 ? (
          <div className="border border-line divide-y divide-line overflow-hidden" style={{ borderRadius: '2px' }}>
            {account.connectedTeams.map((ct) => (
              <div key={ct.id} className="flex items-center gap-3 px-4 py-3 bg-surface">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-ink leading-none">{ct.teamName}</p>
                  <p
                    className="mt-0.5 text-[10px] text-ink-quaternary"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    Connected {ct.connectedAt}
                  </p>
                </div>
                <button
                  title="Disconnect team"
                  onClick={() => alert(`Disconnect ${ct.teamName}? (not wired in demo)`)}
                  className="shrink-0 flex items-center gap-1 p-1.5 text-[10px] text-ink-quaternary transition-colors hover:text-signal-danger hover:bg-signal-danger/8 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
                  style={{ borderRadius: '4px' }}
                >
                  <Unlink size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : !showConnectForm ? (
          <div
            className="border border-dashed border-line px-5 py-6 text-center"
            style={{ borderRadius: '2px' }}
          >
            <p className="text-[12px] text-ink-tertiary">No teams connected.</p>
            <p className="mt-1 text-[11px] text-ink-quaternary">
              Connect a team to activate this workspace for that team's projects.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  )
}

// ── Detail: Add-ons ───────────────────────────────────────────────────────────

function AddOnsTab({ addOns, currentTier }: { addOns: AddOn[]; currentTier: PlanTier | null }) {
  return (
    <div className="space-y-5">
      <div>
        <p
          className="text-ink-quaternary mb-1 uppercase tracking-widest"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}
        >
          Available add-ons
        </p>
        <p className="text-ink text-sm font-medium">
          Expand your workspace capabilities without upgrading your base plan.
        </p>
      </div>

      {currentTier === 'starter' && (
        <div
          className="flex items-start gap-2.5 border border-primary/20 bg-primary-muted/20 px-4 py-3"
          style={{ borderRadius: '2px' }}
        >
          <ShieldCheck size={13} className="shrink-0 mt-0.5 text-primary-dark" />
          <p className="text-[11px] text-ink-secondary leading-relaxed">
            Add-ons are available on Growth and above. Some add-ons are available on all paid plans.
          </p>
        </div>
      )}

      <div className="border border-line divide-y divide-line overflow-hidden" style={{ borderRadius: '2px' }}>
        {addOns.map((addon) => (
          <div key={addon.id} className="flex items-center gap-4 px-5 py-4 bg-surface hover:bg-surface-alt/40 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink leading-tight">{addon.name}</p>
              <p className="mt-0.5 text-[11px] text-ink-tertiary leading-snug">{addon.description}</p>
              <p
                className="mt-1 text-[10px] text-ink-quaternary"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {addon.quantityUnit}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              {addon.isContactSales ? (
                <a
                  href="mailto:sales@deploytitan.com"
                  className="inline-flex items-center gap-1 border border-line px-3 py-1.5 text-[11px] text-ink-secondary transition-colors hover:border-primary/30 hover:text-ink"
                  style={{ borderRadius: '2px' }}
                >
                  Contact sales
                </a>
              ) : (
                <>
                  <p
                    className="text-[13px] font-semibold text-ink"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {addon.priceMonthly != null ? formatCents(addon.priceMonthly) : '—'}
                    <span className="text-[10px] text-ink-tertiary font-normal ml-0.5">/mo</span>
                  </p>
                  <button
                    className="inline-flex items-center gap-1 bg-ink px-3 py-1.5 text-[11px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                    style={{ borderRadius: '2px' }}
                    onClick={() => alert(`Add ${addon.name} (not wired in demo)`)}
                  >
                    <Plus size={11} />
                    Add
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <p
        className="text-ink-quaternary"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}
      >
        Add-ons are billed monthly alongside the base plan · Cancel any time
      </p>
    </div>
  )
}

// ── Detail: Payment ───────────────────────────────────────────────────────────

function PaymentTab() {
  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Payment method</SectionLabel>
        <div className="border border-line" style={{ borderRadius: '2px' }}>
          <div className="flex items-center justify-between border-b border-line bg-surface-alt px-5 py-3">
            <p
              className="text-[10px] uppercase tracking-[0.08em] text-ink-secondary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Card on file
            </p>
          </div>
          <div className="flex items-center gap-4 px-5 py-4">
            <div
              className="flex h-8 w-12 items-center justify-center border border-line bg-surface-alt shrink-0"
              style={{ borderRadius: '2px' }}
              aria-hidden="true"
            >
              <CreditCard size={14} className="text-ink-tertiary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">Visa ending in 4242</p>
              <p
                className="mt-0.5 text-[10px] text-ink-quaternary"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                Expires 09 / 2028
              </p>
            </div>
            <button
              className="shrink-0 border border-line px-3 py-1.5 text-[11px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              style={{ borderRadius: '2px' }}
              onClick={() => alert('Update payment method via Polar customer portal (not wired in demo)')}
            >
              Update
            </button>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Billing details</SectionLabel>
        <div className="border border-line divide-y divide-line-subtle overflow-hidden" style={{ borderRadius: '2px' }}>
          {[
            { label: 'Name on account', value: 'Alice Chen' },
            { label: 'Billing email',   value: 'alice@acme.com' },
            { label: 'Country',         value: 'United States' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3 bg-surface">
              <span className="text-[12px] text-ink-tertiary">{row.label}</span>
              <span className="text-[12px] text-ink">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-ink-quaternary">
          Billing details are managed via the Polar customer portal.{' '}
          <a
            href="https://polar.sh"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-ink-secondary transition-colors"
          >
            Open portal
          </a>
        </p>
      </section>

      <section>
        <SectionLabel>Manage subscription</SectionLabel>
        <div className="flex gap-3">
          <button
            className="border border-line px-4 py-2 text-[12px] text-ink-secondary transition-colors hover:border-primary/30 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            style={{ borderRadius: '2px' }}
            onClick={() => alert('Change plan via Polar (not wired in demo)')}
          >
            Change plan
          </button>
          <button
            className="border border-signal-danger/30 px-4 py-2 text-[12px] text-signal-danger/80 transition-colors hover:border-signal-danger/60 hover:text-signal-danger hover:bg-signal-danger/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
            style={{ borderRadius: '2px' }}
            onClick={() => alert('Cancel subscription via Polar (not wired in demo)')}
          >
            Cancel subscription
          </button>
        </div>
      </section>
    </div>
  )
}

// ── Detail: Invoices ──────────────────────────────────────────────────────────

function InvoicesTab({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Invoice history</SectionLabel>

      {invoices.length > 0 ? (
        <div className="border border-line overflow-hidden" style={{ borderRadius: '2px' }}>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-line bg-surface-alt px-5 py-2">
            {['Date', 'Description', 'Amount', 'Status'].map((h) => (
              <span
                key={h}
                className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {h}
              </span>
            ))}
          </div>
          {invoices.map((inv, i) => (
            <div
              key={inv.id}
              className={[
                'grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-surface',
                i > 0 ? 'border-t border-line-subtle' : '',
              ].join(' ')}
            >
              <span
                className="text-[11px] text-ink-quaternary"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {inv.date}
              </span>
              <span className="text-[12px] text-ink">{inv.description}</span>
              <span
                className="text-[12px] text-ink"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {formatCents(inv.amount)}
              </span>
              <InvoiceStatusBadge status={inv.status} />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="border border-dashed border-line px-5 py-8 text-center"
          style={{ borderRadius: '2px' }}
        >
          <p className="text-[12px] text-ink-tertiary">No invoices yet.</p>
        </div>
      )}

      <p className="text-[10px] text-ink-quaternary">
        Full invoice PDFs are available in the{' '}
        <a
          href="https://polar.sh"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-ink-secondary transition-colors"
        >
          Polar customer portal
        </a>
        .
      </p>
    </div>
  )
}

// ── Detail: Usage ─────────────────────────────────────────────────────────────

function UsageTab() {
  const usage = DEMO_USAGE

  const resourceRows = [
    { label: 'Services',      used: usage.services.used,      limit: usage.services.limit },
    { label: 'Organizations', used: usage.organizations.used, limit: usage.organizations.limit },
    { label: 'Projects',      used: usage.projects.used,      limit: usage.projects.limit },
    { label: 'Seats',         used: usage.seats.used,         limit: usage.seats.limit },
    { label: 'Environments',  used: usage.environments.used,  limit: usage.environments.limit },
  ]

  const eventRows = [
    { label: 'Deployments completed',          count: usage.deploymentsThisPeriod },
    { label: 'Rollbacks triggered',            count: usage.rollbacksThisPeriod },
    { label: 'Incidents auto-resolved',        count: usage.incidentsAutoResolved },
    { label: 'High-risk PRs flagged',          count: usage.highRiskPrsFlagged },
    { label: 'Policy checks passed',           count: usage.policyChecksRun },
  ]

  return (
    <div className="space-y-8">
      {/* Resource usage */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Resource usage</SectionLabel>
          <span
            className="border border-line bg-surface px-2 py-0.5 text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', borderRadius: '1px' }}
          >
            {usage.period.start} → {usage.period.end}
          </span>
        </div>
        <div className="border border-line divide-y divide-line-subtle overflow-hidden" style={{ borderRadius: '2px' }}>
          {resourceRows.map((row) => {
            const pct = row.limit != null ? Math.min(100, (row.used / row.limit) * 100) : 0
            const isHigh = row.limit != null && pct >= 80
            return (
              <div key={row.label} className="flex items-center gap-4 px-5 py-3 bg-surface">
                <span className="w-28 shrink-0 text-[12px] text-ink-tertiary">{row.label}</span>
                <div className="flex-1 min-w-0">
                  <UsageBar used={row.used} limit={row.limit} />
                </div>
                <span
                  className={`shrink-0 text-[11px] ${isHigh ? 'text-signal-warning' : 'text-ink'}`}
                  style={{ fontFamily: 'JetBrains Mono, monospace', minWidth: '5rem', textAlign: 'right' }}
                >
                  {row.used} / {formatLimit(row.limit)}
                </span>
              </div>
            )
          })}
        </div>
        <p
          className="mt-2 text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Resource limits reset at the start of each billing period
        </p>
      </section>

      {/* Operational events */}
      <section>
        <SectionLabel>Activity this period</SectionLabel>
        <div className="border border-line overflow-hidden" style={{ borderRadius: '2px' }}>
          <div className="flex items-center justify-between border-b border-line bg-surface-alt px-5 py-2">
            <span
              className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Event
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Count
            </span>
          </div>
          {eventRows.map((row, i) => (
            <div
              key={row.label}
              className={[
                'flex items-center justify-between px-5 py-3 bg-surface',
                i > 0 ? 'border-t border-line-subtle' : '',
              ].join(' ')}
            >
              <span className="text-[12px] text-ink-tertiary">{row.label}</span>
              <span
                className="text-[12px] font-medium text-ink"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {row.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <p
          className="mt-2 text-[10px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Operational events are not metered or charged. No per-deployment fees.
        </p>
      </section>
    </div>
  )
}

// ── Account detail panel ──────────────────────────────────────────────────────

function WorkspaceDetail({
  account,
  products,
  addOns,
  productsLoading,
  productsError,
}: {
  account: WorkspaceAccount
  products: BillingProduct[]
  addOns: AddOn[]
  productsLoading: boolean
  productsError: boolean
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const plan = products.find((p) => p.tier === account.planTier)

  return (
    <div className="flex flex-col min-h-0">
      {/* Account header */}
      <div className="border-b border-line px-7 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center bg-ink text-surface text-[13px] font-semibold select-none"
            style={{ borderRadius: '2px' }}
            aria-hidden="true"
          >
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink leading-tight">{account.name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <SubStatusDot status={account.status} />
              <PlanBadge tier={account.planTier} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar + content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
        <TabsList variant="line" className="border-b border-line px-7 w-full justify-start rounded-none">
          {DETAIL_TABS.map(({ id, label, Icon }) => (
            <TabsTrigger key={id} value={id} className="inline-flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium">
              <Icon size={12} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          <TabsContent value="plans">
            <PlansTab
              products={products}
              isLoading={productsLoading}
              isError={productsError}
              currentTier={account.planTier}
            />
          </TabsContent>
          <TabsContent value="overview">
            <OverviewTab account={account} plan={plan} />
          </TabsContent>
          <TabsContent value="addons">
            <AddOnsTab addOns={addOns} currentTier={account.planTier} />
          </TabsContent>
          <TabsContent value="payment">
            <PaymentTab />
          </TabsContent>
          <TabsContent value="invoices">
            <InvoicesTab invoices={account.invoices} />
          </TabsContent>
          <TabsContent value="usage">
            <UsageTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-5 flex h-12 w-12 items-center justify-center border border-line bg-surface-alt text-ink-tertiary"
        style={{ borderRadius: '2px' }}
      >
        <Building2 size={20} strokeWidth={1.5} />
      </div>
      <p className="mb-1 text-[14px] font-medium text-ink">No workspaces yet</p>
      <p className="mb-6 max-w-xs text-[12px] text-ink-tertiary leading-relaxed">
        Create a workspace to subscribe to a plan. Connect your teams to activate them under this subscription.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-[2px] bg-ink px-5 py-2.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus size={13} />
        Create workspace
      </button>
    </div>
  )
}

// ── Success banner ────────────────────────────────────────────────────────────

function SuccessBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="mb-6 flex items-start justify-between gap-4 border border-signal-success/25 bg-signal-success/5 px-5 py-4"
      role="alert"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex items-start gap-3">
        <CheckCircle size={14} className="mt-0.5 shrink-0 text-signal-success" />
        <div>
          <p className="text-[13px] font-medium text-ink">Subscription confirmed</p>
          <p className="mt-0.5 text-[11px] text-ink-tertiary">
            Your workspace is active. Plan limits are applied immediately.
          </p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-ink-quaternary transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BillingPage() {
  const search = useSearch({ strict: false }) as Record<string, string>
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<WorkspaceAccount[]>(DEMO_WORKSPACES)
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_WORKSPACES[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false)

  const { data, isLoading: productsLoading, isError: productsError } = useBillingProducts()

  const products: BillingProduct[] = (() => {
    const source = data?.products && data.products.length > 0 ? data.products : CANONICAL_PLANS
    return [...source].sort((a, b) => (a.priceMonthly ?? 0) - (b.priceMonthly ?? 0))
  })()

  const addOns: AddOn[] = data?.addOns && data.addOns.length > 0 ? data.addOns : CANONICAL_ADDONS

  useEffect(() => {
    if (search['checkout'] === 'success') {
      setShowSuccessBanner(true)
      navigate({ to: '/billing', replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedWorkspace = workspaces.find((w) => w.id === selectedId) ?? null

  const handleCreated = (workspace: WorkspaceAccount) => {
    setWorkspaces((prev) => [...prev, workspace])
    setSelectedId(workspace.id)
    setCreating(false)
    setShowSuccessBanner(true)
  }

  return (
    <div className="flex h-full min-h-full flex-col">
      {/* Page header */}
      <div className="border-b border-line px-8 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-ink mb-0.5 text-xl font-semibold tracking-tight"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
            >
              Billing
            </h1>
            <p className="text-[11px] text-ink-tertiary">
              Manage workspaces, subscriptions, and add-ons.
            </p>
          </div>
          {workspaces.length > 0 && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 border border-line px-4 py-2 text-[12px] text-ink-secondary transition-colors hover:border-primary/30 hover:text-ink hover:bg-primary-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              style={{ borderRadius: '2px' }}
            >
              <Plus size={13} />
              New workspace
            </button>
          )}
        </div>

        {showSuccessBanner && (
          <div className="mt-4">
            <SuccessBanner onDismiss={() => setShowSuccessBanner(false)} />
          </div>
        )}
      </div>

      {/* Body */}
      {workspaces.length === 0 && !creating ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left: workspace list */}
          <div className="w-56 shrink-0 border-r border-line py-3 flex flex-col gap-0.5 overflow-y-auto px-2">
            {workspaces.map((ws) => {
              const active = ws.id === selectedId
              return (
                <button
                  key={ws.id}
                  onClick={() => { setSelectedId(ws.id); setCreating(false) }}
                  className={[
                    'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
                    active ? 'bg-surface-alt' : 'hover:bg-surface-alt/60',
                  ].join(' ')}
                  style={{ borderRadius: '4px' }}
                >
                  <div
                    className={[
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-semibold select-none',
                      active ? 'bg-ink text-surface' : 'bg-surface-alt text-ink-secondary border border-line',
                    ].join(' ')}
                    style={{ borderRadius: '2px' }}
                    aria-hidden="true"
                  >
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[12px] font-medium leading-tight ${active ? 'text-ink' : 'text-ink-secondary'}`}>
                      {ws.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <SubStatusDot status={ws.status} />
                      <PlanBadge tier={ws.planTier} />
                    </div>
                  </div>
                  {active && <ChevronRight size={11} className="mt-1 shrink-0 text-ink-quaternary" />}
                </button>
              )
            })}

            {creating && (
              <div
                className="border border-primary/30 bg-primary-muted/30 px-3 py-2.5"
                style={{ borderRadius: '4px' }}
              >
                <p className="text-[11px] font-medium text-ink">New workspace</p>
                <p className="text-[10px] text-ink-quaternary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  In progress…
                </p>
              </div>
            )}
          </div>

          {/* Right: detail or create form */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {creating ? (
              <div className="px-7 py-6 max-w-2xl">
                <CreateWorkspaceForm
                  products={products}
                  onCancel={() => setCreating(false)}
                  onCreated={handleCreated}
                />
              </div>
            ) : selectedWorkspace ? (
              <WorkspaceDetail
                account={selectedWorkspace}
                products={products}
                addOns={addOns}
                productsLoading={productsLoading}
                productsError={productsError}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
