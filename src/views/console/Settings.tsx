'use client'

/**
 * OrgSettings page — tabbed org-level settings.
 * Route: /orgs/:orgSlug/settings
 *
 * Tabs:
 *   General     — org name, slug, danger zone
 *   SSO         — SAML/OIDC config (Enterprise)
 *   API Keys    — create/revoke org API tokens
 *   Audit Log   — recent platform events (Enterprise)
 *   Compliance  — SOC2, docs, DPA links
 */

import { useEffect, useState } from 'react'
import { useSearch, useNavigate } from '@/lib/navigation'
import {
  Building2,
  Cloud,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Lock,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Users,
  X,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'
import { useOrgProject } from '../../contexts/OrgProjectContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { apiRequest } from '../../lib/api'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'general' | 'members' | 'integrations' | 'sso' | 'api-keys' | 'audit-log' | 'compliance'

const TABS: { id: Tab; label: string; icon: React.ElementType; enterprise?: boolean }[] = [
  { id: 'general',    label: 'General',    icon: Building2 },
  { id: 'members',    label: 'Members',    icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Cloud },
  { id: 'sso',        label: 'SSO',        icon: Lock,         enterprise: true },
  { id: 'api-keys',   label: 'API Keys',   icon: KeyRound },
  { id: 'audit-log',  label: 'Audit Log',  icon: ScrollText,   enterprise: true },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
]

// ─── Demo fixtures ────────────────────────────────────────────────────────────

const DEMO_API_KEYS = [
  { id: 'k1', name: 'CI/CD pipeline',    prefix: 'dt_live_ab12…ef56', createdAt: '2026-04-01', lastUsed: '2 hours ago',  scope: 'write' },
  { id: 'k2', name: 'Monitoring agent',  prefix: 'dt_live_cd34…gh78', createdAt: '2026-03-15', lastUsed: '10 min ago',   scope: 'read'  },
  { id: 'k3', name: 'Local dev',         prefix: 'dt_live_ef56…ij90', createdAt: '2026-02-20', lastUsed: '3 days ago',   scope: 'write' },
]

const DEMO_AUDIT_EVENTS = [
  { id: 'a1', ts: '2026-05-13 09:42',  actor: 'alice@acme.com',    action: 'rollback.triggered',    target: 'payments-service v1.8.1',    severity: 'warn'  },
  { id: 'a2', ts: '2026-05-13 08:17',  actor: 'ci-bot',            action: 'deployment.created',    target: 'auth-service v2.3.0',        severity: 'info'  },
  { id: 'a3', ts: '2026-05-12 16:55',  actor: 'bob@acme.com',      action: 'api_key.created',       target: 'key: CI/CD pipeline',        severity: 'info'  },
  { id: 'a4', ts: '2026-05-12 14:30',  actor: 'alice@acme.com',    action: 'sso.config.updated',    target: 'SAML provider',              severity: 'warn'  },
  { id: 'a5', ts: '2026-05-12 11:00',  actor: 'carol@acme.com',    action: 'member.invited',        target: 'dan@acme.com',               severity: 'info'  },
  { id: 'a6', ts: '2026-05-11 23:14',  actor: 'system',            action: 'slo.breach.detected',   target: 'recommendations-service',    severity: 'error' },
  { id: 'a7', ts: '2026-05-11 18:02',  actor: 'bob@acme.com',      action: 'deployment.approved',   target: 'inventory-service v1.2.0',   severity: 'info'  },
  { id: 'a8', ts: '2026-05-11 09:45',  actor: 'alice@acme.com',    action: 'member.role.changed',   target: 'carol@acme.com → admin',     severity: 'warn'  },
]

type AwsConnectionStatus = 'pending' | 'connected' | 'error'

interface AwsConnection {
  id: string
  accountId: string
  accountAlias: string
  region: string
  roleArn: string
  externalId: string
  status: AwsConnectionStatus
  permissionsValidated: boolean
  lastValidatedAt: string | null
  lastError: string | null
}

const AWS_STORAGE_PREFIX = 'dt:aws-connections:'
const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-south-1',
  'ap-southeast-1',
]

function makeLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function loadAwsConnections(orgKey: string): AwsConnection[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(`${AWS_STORAGE_PREFIX}${orgKey}`)
    if (!raw) return []
    return JSON.parse(raw) as AwsConnection[]
  } catch {
    return []
  }
}

function formatValidationDate(value: string | null) {
  if (!value) return 'Never'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-tertiary mb-3"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {children}
    </p>
  )
}

function EnterpriseBadge() {
  return (
    <span
      className="inline-flex items-center rounded-[2px] border border-amber-300/60 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      Enterprise
    </span>
  )
}

function UpgradeCallout({ feature }: { feature: string }) {
  return (
    <div className="rounded-[2px] border border-dashed border-amber-300/60 bg-amber-50/40 px-5 py-5 dark:border-amber-400/20 dark:bg-amber-400/5">
      <p className="mb-1 text-[13px] font-medium text-ink">{feature} requires an Enterprise plan</p>
      <p className="mb-4 text-[11px] text-ink-tertiary leading-relaxed">
        Upgrade to Enterprise to unlock SSO/SAML, unlimited audit retention, SOC 2 reports, and a
        dedicated SLA.
      </p>
      <a
        href="mailto:sales@deploytitan.com"
        className="inline-flex items-center gap-1.5 rounded-[2px] bg-ink px-3.5 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        Contact sales
        <ExternalLink size={11} />
      </a>
    </div>
  )
}

// ─── Tab: General ─────────────────────────────────────────────────────────────

function GeneralTab({ orgName, orgId }: { orgName: string; orgId: string }) {
  return (
    <div className="space-y-10 max-w-lg">
      {/* Org info */}
      <section>
        <SectionLabel>Organization</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] text-ink-secondary mb-1">
              Display name
            </label>
            <div className="flex items-center rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink">
              {orgName}
            </div>
            <p className="mt-1 text-[10px] text-ink-quaternary">
              Organization names are managed by DeployTitan support.
            </p>
          </div>

          <div>
            <label className="block text-[11px] text-ink-secondary mb-1">Org ID</label>
            <div
              className="flex items-center rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[12px] text-ink-tertiary select-all"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {orgId}
            </div>
            <p className="mt-1 text-[10px] text-ink-quaternary">
              Org ID is a permanent identifier and cannot be changed.
            </p>
          </div>
        </div>
      </section>

      {/* Operations */}
      <section>
        <SectionLabel>Operations</SectionLabel>
        <div className="rounded-[2px] border border-line bg-surface-alt p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ink-tertiary" />
            <div>
              <p className="text-[13px] font-medium text-ink mb-0.5">Organization lifecycle</p>
              <p className="text-[11px] text-ink-tertiary leading-relaxed">
                Organizations are customer account boundaries. Disabling or deleting an organization is
                handled by DeployTitan support so billing, identity, and audit history stay
                consistent.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Tab: SSO ─────────────────────────────────────────────────────────────────

function IntegrationsTab({ orgKey }: { orgKey: string }) {
  const defaultExternalId = `deploytitan-${orgKey}`
  const [connections, setConnections] = useState<AwsConnection[]>(() => loadAwsConnections(orgKey))
  const [form, setForm] = useState({
    accountId: '',
    accountAlias: '',
    region: 'us-east-1',
    roleArn: '',
    externalId: defaultExternalId,
  })
  const [isValidating, setIsValidating] = useState(false)
  const [busyConnectionId, setBusyConnectionId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`${AWS_STORAGE_PREFIX}${orgKey}`, JSON.stringify(connections))
  }, [connections, orgKey])

  const accountIdValid = /^\d{12}$/.test(form.accountId.trim())
  const roleArnValid = new RegExp(`^arn:aws:iam::${form.accountId.trim()}:role\\/.+`).test(form.roleArn.trim())
  const canValidate = accountIdValid && roleArnValid && form.region.trim().length > 0

  const resetForm = () =>
    setForm({
      accountId: '',
      accountAlias: '',
      region: 'us-east-1',
      roleArn: '',
      externalId: defaultExternalId,
    })

  const upsertConnection = (connection: AwsConnection) => {
    setConnections((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== connection.id)
      return [connection, ...withoutCurrent]
    })
  }

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canValidate) return

    setIsValidating(true)

    window.setTimeout(() => {
      const now = new Date().toISOString()
      upsertConnection({
        id: makeLocalId(),
        accountId: form.accountId.trim(),
        accountAlias: form.accountAlias.trim(),
        region: form.region,
        roleArn: form.roleArn.trim(),
        externalId: form.externalId.trim() || defaultExternalId,
        status: 'connected',
        permissionsValidated: true,
        lastValidatedAt: now,
        lastError: null,
      })
      resetForm()
      setIsValidating(false)
    }, 1200)
  }

  const handleRevalidate = (connection: AwsConnection) => {
    setBusyConnectionId(connection.id)
    upsertConnection({
      ...connection,
      status: 'pending',
      permissionsValidated: false,
      lastError: null,
    })

    window.setTimeout(() => {
      upsertConnection({
        ...connection,
        status: 'connected',
        permissionsValidated: true,
        lastValidatedAt: new Date().toISOString(),
        lastError: null,
      })
      setBusyConnectionId(null)
    }, 1000)
  }

  return (
    <div className="max-w-5xl space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleValidate}
          className="rounded-[2px] border border-line bg-surface p-5 space-y-5"
        >
          <div>
            <SectionLabel>AWS account connection</SectionLabel>
            <h2 className="text-[18px] font-semibold text-ink mb-1">Connect an AWS account</h2>
            <p className="text-[12px] text-ink-tertiary leading-relaxed max-w-[56ch]">
              Configure the IAM role DeployTitan should assume for Lambda rollout control and
              CloudWatch health checks. Validation stores the account as connected for this
              organization.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] text-ink-secondary mb-1">AWS account ID</label>
              <input
                value={form.accountId}
                onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                placeholder="123456789012"
                className="w-full rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
              {!accountIdValid && form.accountId.length > 0 && (
                <p className="mt-1 text-[10px] text-signal-danger">Use a 12-digit AWS account ID.</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-ink-secondary mb-1">Account alias</label>
              <input
                value={form.accountAlias}
                onChange={(e) => setForm((prev) => ({ ...prev, accountAlias: e.target.value }))}
                placeholder="Production"
                className="w-full rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-[11px] text-ink-secondary mb-1">AWS region</label>
              <select
                value={form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                className="w-full rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {AWS_REGIONS.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-ink-secondary mb-1">External ID</label>
              <input
                value={form.externalId}
                onChange={(e) => setForm((prev) => ({ ...prev, externalId: e.target.value }))}
                className="w-full rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink-secondary mb-1">IAM role ARN</label>
            <input
              value={form.roleArn}
              onChange={(e) => setForm((prev) => ({ ...prev, roleArn: e.target.value }))}
              placeholder="arn:aws:iam::123456789012:role/deploytitan-controller"
              className="w-full rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
            {!roleArnValid && form.roleArn.length > 0 && (
              <p className="mt-1 text-[10px] text-signal-danger">
                Role ARN must match the current AWS account ID.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canValidate || isValidating}
              className="inline-flex items-center gap-2 rounded-[2px] bg-ink px-4 py-2 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            >
              {isValidating ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
              {isValidating ? 'Validating connection...' : 'Validate and connect'}
            </button>
            <span className="text-[11px] text-ink-quaternary">
              Validation checks account shape, role format, and stores the connection state.
            </span>
          </div>
        </form>

        <div className="rounded-[2px] border border-line bg-surface-alt p-5">
          <SectionLabel>IAM role setup</SectionLabel>
          <div className="space-y-4 text-[12px] text-ink-secondary leading-relaxed">
            <p>
              Create an IAM role in the target AWS account that DeployTitan can assume. The role
              should trust the DeployTitan control plane and enforce the external ID shown here.
            </p>
            <div className="rounded-[2px] border border-line bg-surface px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                Required trust values
              </p>
              <div className="space-y-2 text-[11px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-quaternary">Principal</span>
                  <span className="text-right text-ink">arn:aws:iam::999999999999:role/deploytitan-control-plane</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-quaternary">External ID</span>
                  <span className="text-right text-ink">{form.externalId || defaultExternalId}</span>
                </div>
              </div>
            </div>
            <ol className="space-y-2 list-decimal pl-4">
              <li>Create or reuse a role such as <span className="font-mono text-ink">deploytitan-controller</span>.</li>
              <li>Grant read access for Lambda functions, versions, aliases, and CloudWatch metrics.</li>
              <li>Grant write access for Lambda alias updates used during rollout traffic shifts.</li>
              <li>Paste the role ARN back into this form and validate the connection.</li>
            </ol>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Connected AWS accounts</SectionLabel>
          <span className="text-[11px] text-ink-quaternary">{connections.length} connected</span>
        </div>

        {connections.length === 0 ? (
          <div className="rounded-[2px] border border-dashed border-line px-5 py-8 text-center">
            <p className="text-[13px] text-ink">No AWS accounts connected yet.</p>
            <p className="mt-1 text-[11px] text-ink-tertiary">
              Connect an account above to unlock Lambda registration and rollout management.
            </p>
          </div>
        ) : (
          <div className="rounded-[2px] border border-line overflow-hidden divide-y divide-line">
            {connections.map((connection) => {
              const isBusy = busyConnectionId === connection.id
              return (
                <div key={connection.id} className="bg-surface px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-medium text-ink">
                          {connection.accountAlias || `AWS ${connection.accountId}`}
                        </p>
                        <span
                          className={[
                            'rounded-[2px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]',
                            connection.status === 'connected'
                              ? 'bg-signal-success/10 text-signal-success'
                              : connection.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-signal-danger/10 text-signal-danger',
                          ].join(' ')}
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {connection.status}
                        </span>
                      </div>
                      <div
                        className="mt-1 space-y-1 text-[11px] text-ink-tertiary"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        <p>{connection.accountId} · {connection.region}</p>
                        <p className="truncate">{connection.roleArn}</p>
                        <p>Last validated: {formatValidationDate(connection.lastValidatedAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRevalidate(connection)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-[2px] border border-line px-3 py-1.5 text-[11px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink disabled:opacity-40"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Revalidate
                      </button>
                      <button
                        type="button"
                        onClick={() => setConnections((prev) => prev.filter((item) => item.id !== connection.id))}
                        className="inline-flex items-center gap-1.5 rounded-[2px] border border-line px-3 py-1.5 text-[11px] text-ink-tertiary transition-colors hover:border-signal-danger/30 hover:text-signal-danger"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Tab: SSO ─────────────────────────────────────────────────────────────────

function SSOTab({
  isEnterprise,
  workosOrgId,
}: {
  isEnterprise: boolean
  workosOrgId: string | null
}) {
  if (!isEnterprise) {
    return <UpgradeCallout feature="Single Sign-On (SSO)" />
  }

  const identityRows = [
    { label: 'Org ID', value: workosOrgId ?? 'Not provisioned' },
    {
      label: 'SSO / Directory Sync',
      value: workosOrgId ? 'Managed via Admin Portal' : 'Pending provisioning',
      highlight: !!workosOrgId,
    },
  ]

  return (
    <div className="space-y-8 max-w-lg">
      <section>
        <SectionLabel>Enterprise identity</SectionLabel>
        <div className="space-y-3">
          {identityRows.map(({ label, value, highlight }) => (
            <div key={label} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
              <span className="text-[11px] text-ink-tertiary">{label}</span>
              <span
                className={[
                  'text-[12px]',
                  highlight ? 'text-signal-success font-medium' : 'text-ink',
                ].join(' ')}
                style={!highlight ? { fontFamily: 'JetBrains Mono, monospace' } : undefined}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>IT admin setup</SectionLabel>
        <div className="rounded-[2px] border border-line bg-surface px-4 py-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Managed through the Admin Portal</p>
            <p className="text-[11px] text-ink-tertiary">
              DeployTitan provisions one identity organization per customer and sends a
              secure setup link to the customer IT admin.
            </p>
          </div>
        </div>
      </section>

      <a
        href="mailto:support@deploytitan.com?subject=Enable%20enterprise%20SSO"
        className="inline-flex rounded-[2px] border border-line px-4 py-1.5 text-[12px] text-ink-secondary transition-colors hover:border-primary/30 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        Request setup link
      </a>
    </div>
  )
}

// ─── Tab: API Keys ────────────────────────────────────────────────────────────

function APIKeysTab() {
  const [keys, setKeys] = useState(DEMO_API_KEYS)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState<'read' | 'write'>('write')
  const [revealed, setRevealed] = useState<string | null>(null)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const fake = `dt_live_${Math.random().toString(36).slice(2, 8)}…${Math.random().toString(36).slice(2, 6)}`
    const created = {
      id: Math.random().toString(36).slice(2),
      name: newName.trim(),
      prefix: fake,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      scope: newScope,
    }
    setKeys((prev) => [created, ...prev])
    setRevealed(created.id)
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <SectionLabel>API Keys</SectionLabel>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-[2px] border border-line px-2.5 py-1 text-[11px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink hover:bg-primary-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <Plus size={11} strokeWidth={2} />
            New key
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="rounded-[2px] border border-line bg-surface-alt p-4 space-y-3"
        >
          <p
            className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            Create API key
          </p>
          <div>
            <label htmlFor="key-name" className="block text-[11px] text-ink-secondary mb-1">Key name</label>
            <input
              id="key-name"
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. GitHub Actions"
              className="w-full rounded-[2px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-ink-secondary mb-1">Scope</label>
            <div className="flex gap-2">
              {(['read', 'write'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewScope(s)}
                  className={[
                    'rounded-[2px] border px-3 py-1 text-[11px] capitalize transition-colors focus:outline-none',
                    newScope === s
                      ? 'border-ink bg-ink text-surface'
                      : 'border-line text-ink-tertiary hover:border-primary/30 hover:text-ink',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-[2px] bg-ink px-4 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            >
              Create key
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-[2px] px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-[2px] border border-line divide-y divide-line overflow-hidden">
        {keys.map((key) => (
          <div key={key.id} className="flex items-center gap-3 px-4 py-4 bg-surface">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink leading-none mb-1">{key.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] text-ink-quaternary"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {revealed === key.id ? 'dt_live_••••••••••••••••••••••' : key.prefix}
                </span>
                <span className="text-[10px] text-ink-quaternary">·</span>
                <span className="text-[10px] text-ink-quaternary capitalize">{key.scope}</span>
                <span className="text-[10px] text-ink-quaternary">·</span>
                <span className="text-[10px] text-ink-quaternary">Last used {key.lastUsed}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                title="Copy key"
                onClick={() => {
                  navigator.clipboard.writeText(key.prefix).catch((err) => {
                    console.error('[Settings] clipboard copy failed', err)
                    logFrontendEvent({ level: 'error', message: 'clipboard.copy.failed', context: { error: err, location: 'Settings' } })
                  })
                  setRevealed(key.id)
                  setTimeout(() => setRevealed(null), 3000)
                }}
                className="rounded-[6px] p-1.5 text-ink-quaternary transition-colors hover:text-ink hover:bg-surface-alt focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              >
                {revealed === key.id ? <CheckCircle2 size={13} className="text-signal-success" /> : <Copy size={13} />}
              </button>
              <button
                title="Revoke key"
                onClick={() => {
                  if (confirm(`Revoke "${key.name}"? This cannot be undone.`)) {
                    setKeys((prev) => prev.filter((k) => k.id !== key.id))
                  }
                }}
                className="rounded-[6px] p-1.5 text-ink-quaternary transition-colors hover:text-signal-danger hover:bg-signal-danger/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-quaternary leading-relaxed">
        API keys grant programmatic access to your DeployTitan project. Treat them like passwords —
        store them in secrets managers, never commit them to source control.
      </p>
    </div>
  )
}

// ─── Tab: Audit Log ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  info:  'text-ink-tertiary',
  warn:  'text-amber-600 dark:text-amber-400',
  error: 'text-signal-danger',
}

function AuditLogTab({ isEnterprise }: { isEnterprise: boolean }) {
  if (!isEnterprise) {
    return <UpgradeCallout feature="Audit Log" />
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <SectionLabel>Recent events</SectionLabel>
        <button className="flex items-center gap-1.5 rounded-[2px] border border-line px-2.5 py-1 text-[11px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40">
          Export CSV
        </button>
      </div>

      <div className="rounded-[2px] border border-line overflow-hidden divide-y divide-line">
        {DEMO_AUDIT_EVENTS.map((ev) => (
          <div key={ev.id} className="flex items-start gap-4 px-4 py-4 bg-surface hover:bg-surface-alt transition-colors">
            <span
              className="shrink-0 w-32 text-[10px] text-ink-quaternary leading-relaxed pt-0.5"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {ev.ts}
            </span>
            <span
              className={[
                'shrink-0 w-36 text-[11px] font-medium leading-relaxed',
                SEVERITY_STYLES[ev.severity] ?? 'text-ink-tertiary',
              ].join(' ')}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {ev.action}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink truncate">{ev.target}</p>
              <p className="text-[10px] text-ink-quaternary">{ev.actor}</p>
            </div>
            {ev.severity === 'warn' && (
              <AlertTriangle size={13} className="shrink-0 text-amber-500 mt-0.5" />
            )}
            {ev.severity === 'error' && (
              <AlertTriangle size={13} className="shrink-0 text-signal-danger mt-0.5" />
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-quaternary">
        Enterprise plans retain 90 days of audit events. Export to your SIEM at any time.
      </p>
    </div>
  )
}

// ─── Tab: Compliance ─────────────────────────────────────────────────────────

const COMPLIANCE_DOCS = [
  { label: 'SOC 2 Type II report',    status: 'available',  href: '#',  note: 'Last updated Jan 2026' },
  { label: 'ISO 27001 certificate',   status: 'available',  href: '#',  note: 'Valid through Dec 2026' },
  { label: 'Data Processing Addendum', status: 'available', href: '#',  note: 'GDPR-compliant DPA' },
  { label: 'HIPAA BAA',               status: 'enterprise', href: null, note: 'Enterprise plans only' },
  { label: 'Penetration test report', status: 'available',  href: '#',  note: 'Q4 2025 by Cobalt.io' },
  { label: 'Privacy Policy',          status: 'available',  href: '#',  note: '' },
  { label: 'Terms of Service',        status: 'available',  href: '#',  note: '' },
]

function ComplianceTab() {
  return (
    <div className="space-y-8 max-w-lg">
      <section>
        <SectionLabel>Certifications &amp; documents</SectionLabel>
        <ul className="rounded-[2px] border border-line divide-y divide-line overflow-hidden">
          {COMPLIANCE_DOCS.map((doc) => (
            <li key={doc.label} className="flex items-center justify-between px-4 py-4 bg-surface">
              <div>
                <p className="text-[13px] text-ink">{doc.label}</p>
                {doc.note && <p className="text-[10px] text-ink-quaternary mt-0.5">{doc.note}</p>}
              </div>
              {doc.status === 'enterprise' ? (
                <EnterpriseBadge />
              ) : doc.href ? (
                <a
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                >
                  Download
                  <ExternalLink size={10} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionLabel>Data residency</SectionLabel>
        <div className="rounded-[2px] border border-line bg-surface px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink">Primary region</span>
            <span
              className="text-[12px] text-ink"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              us-east-1
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink">Custom region</span>
            <EnterpriseBadge />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Security contact</SectionLabel>
        <p className="text-[12px] text-ink-tertiary leading-relaxed">
          To report a vulnerability, email{' '}
          <a
            href="mailto:security@deploytitan.com"
            className="text-ink underline underline-offset-2 hover:text-primary transition-colors"
          >
            security@deploytitan.com
          </a>{' '}
          or use our{' '}
          <a
            href="#"
            className="text-ink underline underline-offset-2 hover:text-primary transition-colors"
          >
            responsible disclosure form
          </a>
          .
        </p>
      </section>
    </div>
  )
}

// ─── Tab: Members ─────────────────────────────────────────────────────────────

const MEMBER_ROLES = ['Member', 'Admin', 'Viewer'] as const
type MemberRole = (typeof MEMBER_ROLES)[number]

interface MemberInviteEntry {
  id: string
  email: string
  role: MemberRole
}

let _settingsMemberIdCounter = 0
const nextMemberId = () => String(++_settingsMemberIdCounter)
const makeMemberEntry = (): MemberInviteEntry => ({ id: nextMemberId(), email: '', role: 'Member' })

// Demo existing members fixture
const DEMO_MEMBERS = [
  { id: 'm1', name: 'Alice Chen',   email: 'alice@acme.com',  role: 'Admin',  joinedAt: '2026-01-10' },
  { id: 'm2', name: 'Bob Patel',    email: 'bob@acme.com',    role: 'Member', joinedAt: '2026-02-14' },
  { id: 'm3', name: 'Carol Kim',    email: 'carol@acme.com',  role: 'Member', joinedAt: '2026-03-01' },
]

function MembersTab({ orgId }: { orgId: string }) {
  const [entries, setEntries] = useState<MemberInviteEntry[]>([makeMemberEntry()])
  const [sent, setSent] = useState(false)

  const hasValid = entries.some((e) => e.email.trim().includes('@'))

  const mutation = useMutation({
    mutationFn: (items: MemberInviteEntry[]) =>
      apiRequest('/orgs/' + orgId + '/invites', {
        method: 'POST',
        json: {
          invites: items
            .filter((e) => e.email.trim().includes('@'))
            .map((e) => ({ email: e.email.trim(), role: e.role })),
        },
      }),
    onSuccess: () => {
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setEntries([makeMemberEntry()])
      }, 2000)
    },
    onError: () => {
      setSent(false)
    },
  })

  const update = (id: string, updated: MemberInviteEntry) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
  const remove = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id))

  return (
    <div className="max-w-2xl space-y-8">
      {/* Existing members */}
      <div>
        <SectionLabel>Current members</SectionLabel>
        <div className="rounded-[2px] border border-line overflow-hidden">
          {DEMO_MEMBERS.map((m, i) => (
            <div
              key={m.id}
              className={[
                'flex items-center justify-between px-4 py-3 gap-4',
                i < DEMO_MEMBERS.length - 1 ? 'border-b border-line-subtle' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-7 h-7 flex items-center justify-center bg-ink text-surface text-[10px] font-semibold shrink-0"
                  style={{ borderRadius: '2px' }}
                >
                  {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[13px] font-medium text-ink truncate"
                    style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
                  >
                    {m.name}
                  </p>
                  <p className="text-[11px] text-ink-tertiary font-mono truncate">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-tertiary border border-line px-1.5 py-0.5"
                  style={{ borderRadius: '2px' }}
                >
                  {m.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form */}
      <div>
        <SectionLabel>Invite by email</SectionLabel>

        {sent ? (
          <div className="flex items-center gap-2 text-[13px] text-ink py-3">
            <CheckCircle2 size={14} className="text-signal-success shrink-0" />
            <span style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}>
              Invites sent successfully.
            </span>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(entries) }}
            noValidate
            className="space-y-4"
          >
            {/* Column headers */}
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-tertiary">Email</span>
              <span className="w-28 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-tertiary">Role</span>
              <span className="w-6" />
            </div>

            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={entry.email}
                    onChange={(e) => update(entry.id, { ...entry, email: e.target.value })}
                    className="flex-1 bg-surface border border-line text-sm text-ink placeholder:text-ink-quaternary
                               px-3 py-2
                               focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
                               transition-colors"
                    style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
                  />
                  <div className="relative w-28">
                    <select
                      value={entry.role}
                      onChange={(e) => update(entry.id, { ...entry, role: e.target.value as MemberRole })}
                      className="w-full appearance-none bg-surface border border-line text-sm text-ink
                                 pl-3 pr-7 py-2
                                 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
                                 transition-colors cursor-pointer"
                      style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
                    >
                      {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-quaternary"
                      width="9" height="9" viewBox="0 0 12 12" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                    >
                      <polyline points="2 4 6 8 10 4" />
                    </svg>
                  </div>
                  {entries.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      className="w-6 flex items-center justify-center text-ink-quaternary hover:text-ink-tertiary transition-colors focus-visible:outline-none rounded-[2px]"
                      aria-label="Remove"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  ) : (
                    <span className="w-6" />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEntries((prev) => [...prev, makeMemberEntry()])}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-tertiary hover:text-ink-secondary transition-colors focus-visible:outline-none rounded-[2px]"
            >
              <Plus size={11} strokeWidth={2} />
              Add another
            </button>

            <div className="pt-1">
              <button
                type="submit"
                disabled={!hasValid || mutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-surface text-[12px] font-medium
                           hover:bg-ink/90 active:scale-[0.97] transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                style={{ borderRadius: '2px', fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
              >
                {mutation.isPending ? (
                  <>
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    Sending...
                  </>
                ) : 'Send invites'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export function OrgSettings() {
  const search = useSearch({ strict: false }) as Record<string, string>
  const activeTab = search['tab'] ?? 'general'
  const navigate = useNavigate()
  const { orgName, orgSlug, orgId } = useOrgProject()
  const [org] = useQuery(queries.orgById({ workosOrgId: orgId ?? '' }))

  // Demo: treat as non-enterprise so upgrade callouts are visible
  const isEnterprise = false

  const displayOrgName = orgName ?? 'My Organization'
  const displayOrgSlug = orgSlug ?? orgId ?? 'my-org'

  return (
    <div className="px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold tracking-tight text-ink mb-1"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
        >
          Settings
        </h1>
        <p className="text-[11px] text-ink-tertiary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {orgId ?? displayOrgSlug}
        </p>
      </div>

      {/* Tab bar + content */}
      <Tabs value={activeTab} onValueChange={(v) => navigate({ to: '.', search: { tab: v } })}>
        <TabsList variant="line" className="sticky top-0 z-10 bg-surface border-b border-line mb-8 w-full justify-start -mx-8 px-8 rounded-none">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] rounded-t-[2px]">
                <Icon size={13} />
                {tab.label}
                {tab.enterprise && !isEnterprise && (
                  <span className="ml-0.5">
                    <Lock size={9} className="text-ink-quaternary" />
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="general"><GeneralTab orgName={displayOrgName} orgId={orgId ?? ''} /></TabsContent>
        <TabsContent value="members"><MembersTab orgId={orgId ?? ''} /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab orgKey={displayOrgSlug} /></TabsContent>
        <TabsContent value="sso">
          <SSOTab
            isEnterprise={isEnterprise}
            workosOrgId={org?.workosOrgId ?? null}
          />
        </TabsContent>
        <TabsContent value="api-keys"><APIKeysTab /></TabsContent>
        <TabsContent value="audit-log"><AuditLogTab isEnterprise={isEnterprise} /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab /></TabsContent>
      </Tabs>
    </div>
  )
}
