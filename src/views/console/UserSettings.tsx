'use client'

/**
 * UserSettings — personal account settings for the authenticated user.
 * Route: /settings
 *
 * Single scrollable page. Sections:
 *   Profile, Notifications, Preferences, API Tokens, Danger Zone
 *
 * A sticky in-page nav at the top lets users jump to any section.
 * No secondary sidebar — full width content.
 */

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  TriangleAlert,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { UserAvatar } from '../../components/ui/UserAvatar'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-1 text-[15px] font-semibold text-ink tracking-tight"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.01em' }}
    >
      {children}
    </h2>
  )
}

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

function Divider() {
  return <hr className="border-line" />
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium text-ink-secondary">
      {children}
    </label>
  )
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  readOnly,
  type = 'text',
}: {
  id?: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  type?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      className={[
        'w-full border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/40',
        readOnly
          ? 'border-line bg-surface-alt text-ink-tertiary cursor-default select-all'
          : 'border-line',
      ].join(' ')}
      style={{ borderRadius: '2px' }}
    />
  )
}

function SaveButton({
  disabled,
  saving,
  saved,
  onClick,
}: {
  disabled?: boolean
  saving?: boolean
  saved?: boolean
  onClick?: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={disabled || saving}
        onClick={onClick}
        className="rounded-[2px] bg-ink px-4 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      {saved && (
        <span className="flex items-center gap-1.5 text-[11px] text-signal-success">
          <CheckCircle2 size={12} />
          Saved
        </span>
      )}
    </div>
  )
}

// ── Section: Profile ───────────────────────────────────────────────────────────

function ProfileSection({
  email,
  firstName,
  lastName,
  profilePictureUrl,
}: {
  email: string
  firstName: string | null | undefined
  lastName: string | null | undefined
  profilePictureUrl: string | null | undefined
}) {
  const [displayName, setDisplayName] = useState(
    [firstName, lastName].filter(Boolean).join(' ') || 'Your name',
  )
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const originalName = [firstName, lastName].filter(Boolean).join(' ') || 'Your name'

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <section id="profile" className="space-y-6">
      <div>
        <SectionHeading id="profile">Profile</SectionHeading>
        <p className="text-[12px] text-ink-tertiary mt-0.5">Your name and public identity.</p>
      </div>

      <form onSubmit={handleSave} className="max-w-lg space-y-5">
        {/* Avatar + identity preview */}
        <div className="flex items-center gap-4">
          <UserAvatar
            profilePictureUrl={profilePictureUrl}
            firstName={firstName}
            lastName={lastName}
            email={email}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink leading-tight">
              {displayName || 'Your name'}
            </p>
            <p
              className="mt-0.5 text-[11px] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {email}
            </p>
          </div>
        </div>

        <Divider />

        <div>
          <FieldLabel htmlFor="display-name">Display name</FieldLabel>
          <TextInput
            id="display-name"
            value={displayName}
            onChange={(v) => { setDisplayName(v); setSaved(false) }}
            placeholder="Your name"
          />
        </div>

        <div>
          <FieldLabel htmlFor="user-email">Email</FieldLabel>
          <TextInput id="user-email" value={email} readOnly />
          <p className="mt-1 text-[10px] text-ink-quaternary">
            Email is managed by your authentication provider.
          </p>
        </div>

        <SaveButton
          disabled={displayName.trim() === originalName}
          saving={saving}
          saved={saved}
        />
      </form>
    </section>
  )
}

// ── Section: Notifications ─────────────────────────────────────────────────────

type NotifChannel = 'email' | 'inapp'

interface NotifEvent {
  id: string
  label: string
  description: string
  email: boolean
  inapp: boolean
}

const DEFAULT_NOTIF_EVENTS: NotifEvent[] = [
  { id: 'deploy.success',          label: 'Deployment completed',    description: 'When a deployment finishes successfully.',                  email: true,  inapp: true  },
  { id: 'deploy.failed',           label: 'Deployment failed',       description: 'When a deployment fails or is rolled back.',                email: true,  inapp: true  },
  { id: 'rollback',                label: 'Rollback triggered',      description: 'When an automatic or manual rollback fires.',               email: true,  inapp: true  },
  { id: 'services.limit_warning',  label: 'Service limit warning',   description: 'When connected services approach your plan limit.',         email: true,  inapp: false },
  { id: 'billing.renewal',         label: 'Subscription renewal',    description: 'When your subscription renews or a payment is processed.',  email: true,  inapp: false },
  { id: 'billing.plan_change',     label: 'Plan changed',            description: 'When your workspace plan is upgraded or downgraded.',       email: true,  inapp: true  },
  { id: 'member.joined',           label: 'Member joined org',       description: 'When a new member joins one of your orgs.',                email: false, inapp: true  },
  { id: 'incident',                label: 'Incident detected',       description: 'When Foresight detects a high-risk signal.',               email: true,  inapp: true  },
]

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-4 w-7 shrink-0 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
        checked ? 'bg-ink' : 'bg-line',
      ].join(' ')}
      style={{ borderRadius: '2px' }}
    >
      <span
        className="absolute top-0.5 h-3 w-3 bg-surface transition-all"
        style={{
          borderRadius: '1px',
          left: checked ? 'calc(100% - 14px)' : '2px',
          transition: 'left 0.15s cubic-bezier(0.22,1,0.36,1)',
        }}
      />
    </button>
  )
}

function NotificationsSection() {
  const [events, setEvents] = useState(DEFAULT_NOTIF_EVENTS)
  const [saved, setSaved] = useState(false)

  const toggle = (id: string, channel: NotifChannel) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === id ? { ...ev, [channel]: !ev[channel as keyof NotifEvent] } : ev,
      ),
    )
    setSaved(false)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <section id="notifications" className="space-y-6">
      <div>
        <SectionHeading id="notifications">Notifications</SectionHeading>
        <p className="text-[12px] text-ink-tertiary mt-0.5">
          Choose which events notify you by email or in-app.
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-4">
        <div className="border border-line overflow-hidden" style={{ borderRadius: '2px' }}>
          <div className="grid grid-cols-[1fr_64px_64px] border-b border-line bg-surface-alt px-4 py-2">
            <span
              className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Event
            </span>
            <span
              className="text-center text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Email
            </span>
            <span
              className="text-center text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              In-app
            </span>
          </div>
          {events.map((ev, i) => (
            <div
              key={ev.id}
              className={[
                'grid grid-cols-[1fr_64px_64px] items-center px-4 py-4',
                i > 0 ? 'border-t border-line-subtle' : '',
              ].join(' ')}
            >
              <div className="min-w-0 pr-4">
                <p className="text-[12px] font-medium text-ink">{ev.label}</p>
                <p className="mt-0.5 text-[11px] text-ink-tertiary leading-snug">{ev.description}</p>
              </div>
              <div className="flex justify-center">
                <Toggle
                  checked={ev.email}
                  onChange={() => toggle(ev.id, 'email')}
                  ariaLabel={`Email for ${ev.label}`}
                />
              </div>
              <div className="flex justify-center">
                <Toggle
                  checked={ev.inapp}
                  onChange={() => toggle(ev.id, 'inapp')}
                  ariaLabel={`In-app for ${ev.label}`}
                />
              </div>
            </div>
          ))}
        </div>
        <SaveButton saved={saved} />
      </form>
    </section>
  )
}

// ── Section: Preferences ───────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
]

function PreferencesSection() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [timezone, setTimezone] = useState('UTC')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <section id="preferences" className="space-y-6">
      <div>
        <SectionHeading id="preferences">Preferences</SectionHeading>
        <p className="text-[12px] text-ink-tertiary mt-0.5">Appearance and locale settings.</p>
      </div>

      <form onSubmit={handleSave} className="max-w-lg space-y-8">
        <div className="space-y-2">
          <SectionLabel>Appearance</SectionLabel>
          <FieldLabel>Theme</FieldLabel>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTheme(t); setSaved(false) }}
                className={[
                  'border px-4 py-2 text-[12px] capitalize transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                  theme === t
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line text-ink-tertiary hover:border-primary/30 hover:text-ink',
                ].join(' ')}
                style={{ borderRadius: '2px' }}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-ink-quaternary">
            System follows your OS preference. This sets the console UI only.
          </p>
        </div>

        <Divider />

        <div className="space-y-2">
          <SectionLabel>Locale</SectionLabel>
          <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSaved(false) }}
            className="w-full border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            style={{ borderRadius: '2px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <p className="text-[10px] text-ink-quaternary">
            Used for timestamps in the console and notification emails.
          </p>
        </div>

        <SaveButton saved={saved} />
      </form>
    </section>
  )
}

// ── Section: API Tokens ────────────────────────────────────────────────────────

const DEMO_TOKENS = [
  { id: 't1', name: 'GitHub Actions', prefix: 'dt_pat_ab12…ef56', createdAt: '2026-04-01', lastUsed: '2 hours ago', scope: 'write' },
  { id: 't2', name: 'Local dev',      prefix: 'dt_pat_cd34…gh78', createdAt: '2026-03-15', lastUsed: '3 days ago',  scope: 'read'  },
]

function ApiTokensSection() {
  const [tokens, setTokens] = useState(DEMO_TOKENS)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState<'read' | 'write'>('write')
  const [newExpiry, setNewExpiry] = useState<'never' | '30d' | '90d' | '1y'>('never')
  const [revealed, setRevealed] = useState<string | null>(null)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const fake = `dt_pat_${Math.random().toString(36).slice(2, 8)}…${Math.random().toString(36).slice(2, 6)}`
    const created = {
      id: Math.random().toString(36).slice(2),
      name: newName.trim(),
      prefix: fake,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      scope: newScope,
    }
    setTokens((prev) => [created, ...prev])
    setRevealed(created.id)
    setNewName('')
    setNewScope('write')
    setNewExpiry('never')
    setCreating(false)
  }

  return (
    <section id="api-tokens" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionHeading id="api-tokens">API Tokens</SectionHeading>
          <p className="text-[12px] text-ink-tertiary mt-0.5">
            Personal access tokens for CLI and API access.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 flex items-center gap-1.5 border border-line px-2.5 py-1.5 text-[11px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink hover:bg-primary-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            style={{ borderRadius: '2px' }}
          >
            <Plus size={11} strokeWidth={2} />
            New token
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="max-w-2xl border border-line bg-surface-alt p-4 space-y-3"
          style={{ borderRadius: '2px' }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            New personal access token
          </p>

          <div>
            <FieldLabel htmlFor="token-name">Token name</FieldLabel>
            <TextInput
              id="token-name"
              value={newName}
              onChange={setNewName}
              placeholder="e.g. GitHub Actions"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Scope</FieldLabel>
              <div className="flex gap-1.5">
                {(['read', 'write'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewScope(s)}
                    className={[
                      'border px-3 py-1.5 text-[11px] capitalize transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                      newScope === s
                        ? 'border-ink bg-ink text-surface'
                        : 'border-line text-ink-tertiary hover:border-primary/30 hover:text-ink',
                    ].join(' ')}
                    style={{ borderRadius: '2px' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="token-expiry">Expiry</FieldLabel>
              <select
                id="token-expiry"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value as typeof newExpiry)}
                className="w-full border border-line bg-surface px-2 py-1.5 text-[12px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                style={{ borderRadius: '2px', fontFamily: 'JetBrains Mono, monospace' }}
              >
                <option value="never">No expiry</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="1y">1 year</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-[2px] bg-ink px-4 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            >
              Generate token
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName('') }}
              className="px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="max-w-2xl">
        {tokens.length > 0 ? (
          <div className="border border-line divide-y divide-line overflow-hidden" style={{ borderRadius: '2px' }}>
            {tokens.map((tok) => (
              <div key={tok.id} className="flex items-center gap-3 px-4 py-4 bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-medium text-ink leading-none">{tok.name}</p>
                    <span
                      className={[
                        'border px-1.5 py-px text-[9px] uppercase tracking-[0.06em]',
                        tok.scope === 'write'
                          ? 'border-primary/30 text-primary-dark bg-primary-muted/40'
                          : 'border-line text-ink-quaternary bg-surface-alt',
                      ].join(' ')}
                      style={{ borderRadius: '1px', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {tok.scope}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] text-ink-quaternary"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {revealed === tok.id ? 'dt_pat_••••••••••••••••••' : tok.prefix}
                    </span>
                    <span className="text-[10px] text-ink-quaternary">·</span>
                    <span className="text-[10px] text-ink-quaternary">Last used {tok.lastUsed}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Copy token"
                    onClick={() => {
                      navigator.clipboard.writeText(tok.prefix).catch((err) => {
                        console.error('[UserSettings] clipboard copy failed', err)
                        logFrontendEvent({ level: 'error', message: 'clipboard.copy.failed', context: { error: err, location: 'UserSettings' } })
                      })
                      setRevealed(tok.id)
                      setTimeout(() => setRevealed(null), 3000)
                    }}
                    className="p-1.5 text-ink-quaternary transition-colors hover:text-ink hover:bg-surface-alt focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                    style={{ borderRadius: '6px' }}
                  >
                    {revealed === tok.id
                      ? <CheckCircle2 size={13} className="text-signal-success" />
                      : <Copy size={13} />}
                  </button>
                  <button
                    title="Revoke token"
                    onClick={() => {
                      if (confirm(`Revoke "${tok.name}"? This cannot be undone.`)) {
                        setTokens((prev) => prev.filter((t) => t.id !== tok.id))
                      }
                    }}
                    className="p-1.5 text-ink-quaternary transition-colors hover:text-signal-danger hover:bg-signal-danger/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
                    style={{ borderRadius: '6px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="border border-line bg-surface-alt px-6 py-8 text-center"
            style={{ borderRadius: '2px' }}
          >
            <p className="text-[13px] text-ink-tertiary">No tokens yet.</p>
            <p className="mt-1 text-[11px] text-ink-quaternary">
              Create a token to authenticate CLI and API requests.
            </p>
          </div>
        )}
      </div>

      <p className="max-w-2xl text-[11px] text-ink-quaternary leading-relaxed">
        Personal access tokens authenticate your user account. Treat them like passwords: store in a secrets manager, never commit to source control.
      </p>
    </section>
  )
}

// ── Section: Danger Zone ───────────────────────────────────────────────────────

function DangerSection({ email }: { email: string }) {
  const [confirmValue, setConfirmValue] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <section id="danger" className="space-y-6">
      <div>
        <SectionHeading id="danger">
          <span className="text-signal-danger">Danger zone</span>
        </SectionHeading>
        <p className="text-[12px] text-ink-tertiary mt-0.5">Irreversible account actions.</p>
      </div>

      <div
        className="max-w-lg border border-signal-danger/25 bg-signal-danger/[0.02]"
        style={{ borderRadius: '2px' }}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Delete account</p>
            <p className="mt-0.5 text-[11px] text-ink-tertiary leading-relaxed">
              Permanently deletes your profile, all personal API tokens, and removes you from all organizations. This cannot be undone.
            </p>
          </div>
          {!showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="shrink-0 border border-signal-danger/40 px-3 py-1.5 text-[12px] text-signal-danger transition-colors hover:bg-signal-danger/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
              style={{ borderRadius: '2px' }}
            >
              Delete account
            </button>
          )}
        </div>

        {showConfirm && (
          <div className="border-t border-signal-danger/20 px-5 py-4 space-y-3 bg-signal-danger/[0.03]">
            <p className="text-[12px] text-ink-secondary">
              To confirm, type your email address:{' '}
              <span className="font-mono text-ink">{email}</span>
            </p>
            <TextInput
              value={confirmValue}
              onChange={setConfirmValue}
              placeholder={email}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={confirmValue !== email}
                onClick={() => alert('Account deletion would be triggered here.')}
                className="rounded-[2px] border border-signal-danger/50 bg-signal-danger px-4 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/50"
              >
                Permanently delete
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setConfirmValue('') }}
                className="px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ── In-page jump nav ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'profile',       label: 'Profile' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'preferences',   label: 'Preferences' },
  { id: 'api-tokens',    label: 'API Tokens' },
  { id: 'danger',        label: 'Danger zone' },
] as const

type SectionId = typeof SECTIONS[number]['id']

function JumpNav({ active }: { active: SectionId }) {
  return (
    <nav
      aria-label="Page sections"
      className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-surface pb-4 mb-8 -mx-10 px-10 pt-4"
    >
      {SECTIONS.map(({ id, label }) => {
        const isDanger = id === 'danger'
        const isActive = active === id
        return (
          <a
            key={id}
            href={`#${id}`}
            className={[
              'px-3 py-1.5 text-[12px] rounded-[4px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
              isActive
                ? isDanger
                  ? 'bg-signal-danger/8 text-signal-danger font-medium'
                  : 'bg-surface-alt text-ink font-medium'
                : isDanger
                  ? 'text-signal-danger/60 hover:text-signal-danger hover:bg-signal-danger/5'
                  : 'text-ink-tertiary hover:text-ink hover:bg-surface-alt/60',
            ].join(' ')}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function UserSettings() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<SectionId>('profile')

  const email = user?.email ?? 'user@example.com'

  // Track which section is nearest the top of the viewport
  useEffect(() => {
    const sectionIds = SECTIONS.map((s) => s.id)
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const topVisible = visible[0]
        if (topVisible) {
          setActiveSection(topVisible.target.id as SectionId)
        }
      },
      {
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-full px-10 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-ink text-xl font-semibold tracking-tight"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
        >
          Account settings
        </h1>
        <p
          className="mt-0.5 text-[11px] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {email}
        </p>
      </div>

      {/* Jump nav */}
      <JumpNav active={activeSection} />

      {/* Scrollable sections */}
      <div className="space-y-16">
        <ProfileSection
          email={email}
          firstName={user?.firstName}
          lastName={user?.lastName}
          profilePictureUrl={user?.profilePictureUrl}
        />
        <Divider />
        <NotificationsSection />
        <Divider />
        <PreferencesSection />
        <Divider />
        <ApiTokensSection />
        <Divider />
        <DangerSection email={email} />
      </div>
    </div>
  )
}
