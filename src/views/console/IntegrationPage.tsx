'use client'

/**
 * IntegrationPage — service integration configurator.
 * Route: /integrate
 *
 * Inspired by Revolte.ai's configurator flow: user fills a multi-step form,
 * the wizard generates IaC config files and a GitHub Actions workflow, then
 * "opens a PR" (demo: shows a live diff viewer as if a PR was opened).
 *
 * Steps:
 *   1. Connect repo   — GitHub URL, runtime detection
 *   2. Configure      — strategy, SLO thresholds, gates
 *   3. Review diff    — generated IaC files shown as a git diff
 *   4. Open PR        — "PR opened" confirmation with next steps
 */

import { useState } from 'react'
import { Link, useSearch, useNavigate, useParams } from '@/lib/navigation'
import {
  Link2,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  GitPullRequest,
  ExternalLink,
  Copy,
  CheckCheck,
  Zap,
  ShieldCheck,
  RotateCcw,
  ArrowRight,
} from 'lucide-react'
import { buildIaCDiff, DEMO_SERVICES, type DemoIaCDiff } from '../../lib/demo-data'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

// ─── Types ─────────────────────────────────────────────────────────────────

interface WizardState {
  // Step 1
  repoUrl: string
  serviceName: string
  runtime: string
  // Step 2
  strategy: 'canary' | 'blue-green' | 'ring'
  errorRateThreshold: string
  p99Threshold: string
  initialWeight: string
  promotionWindow: string
  foresightEnabled: boolean
  phoenixEnabled: boolean
  autoRollback: boolean
  blockOnHighRisk: boolean
  slackChannel: string
}

type Step = 1 | 2 | 3 | 4

const RUNTIME_OPTIONS = [
  'Node.js 22 LTS',
  'Node.js 20 LTS',
  'Go 1.22',
  'Python 3.12',
  'Java 21 (Spring Boot)',
  'Rust 1.77',
  'Ruby 3.3',
  'PHP 8.3',
  'Other',
]

const STRATEGY_INFO: Record<string, { label: string; description: string }> = {
  canary:     { label: 'Canary',     description: 'Gradually shift traffic % to the new version. Automatic promotion through SLO gates.' },
  'blue-green': { label: 'Blue/Green', description: 'Spin up a full parallel environment. Instant cut-over with one-click rollback.' },
  ring:       { label: 'Ring',       description: 'Deploy through successive rings (internal → beta → prod). Ideal for background workers.' },
}

// ─── Step indicator ────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={[
              'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
              n < current  ? 'bg-signal-success text-white' :
              n === current ? 'bg-ink text-surface' :
              'bg-line text-ink-quaternary',
            ].join(' ')}
          >
            {n < current ? <CheckCircle2 size={14} /> : n}
          </div>
          {n < total && <div className={`h-px w-8 ${n < current ? 'bg-signal-success' : 'bg-line'}`} />}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Connect repo ──────────────────────────────────────────────────

function Step1({
  state,
  onChange,
  onNext,
}: {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}) {
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState(false)

  const handleDetect = () => {
    if (!state.repoUrl.trim()) return
    setDetecting(true)
    // Simulate detection
    setTimeout(() => {
      // Guess from URL slug
      const slug = state.repoUrl.split('/').pop()?.replace(/[^a-z0-9-]/gi, '') ?? 'my-service'
      // Pick a matching demo service or make a plausible name
      const match = DEMO_SERVICES.find((s) => s.repoUrl === state.repoUrl.trim())
      onChange({
        serviceName: match?.serviceName ?? slug,
        runtime: match?.runtime ?? 'Node.js 22 LTS',
      })
      setDetecting(false)
      setDetected(true)
    }, 1200)
  }

  const canProceed = state.repoUrl.trim() && state.serviceName.trim() && state.runtime

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Connect your repository</h2>
        <p className="text-[12px] text-ink-tertiary">
          Paste your GitHub repo URL. We'll detect the runtime and generate matching config.
        </p>
      </div>

      {/* GitHub URL */}
      <div>
        <label className="block text-[11px] text-ink-secondary mb-1.5">GitHub repository URL</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-quaternary" />
            <input
              type="url"
              value={state.repoUrl}
              onChange={(e) => { onChange({ repoUrl: e.target.value }); setDetected(false) }}
              placeholder="https://github.com/acme/my-service"
              className="w-full rounded-[2px] border border-line bg-surface pl-8 pr-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <button
            type="button"
            onClick={handleDetect}
            disabled={!state.repoUrl.trim() || detecting}
            className="flex items-center gap-1.5 rounded-[2px] border border-line px-3 py-2 text-[12px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink disabled:opacity-40 focus:outline-none"
          >
            {detecting ? <Loader2 size={12} className="animate-spin" /> : null}
            {detecting ? 'Detecting…' : 'Detect'}
          </button>
        </div>
        {detected && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-signal-success">
            <CheckCircle2 size={12} />
            Runtime detected successfully
          </p>
        )}
      </div>

      {/* Or pick an existing unconnected service */}
      <div>
        <p className="text-[10px] text-ink-quaternary uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Or pick from unconnected services</p>
        <div className="space-y-1">
          {DEMO_SERVICES.filter((s) => !s.integrated).map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => {
                onChange({ repoUrl: svc.repoUrl, serviceName: svc.serviceName, runtime: svc.runtime })
                setDetected(true)
              }}
              className="w-full flex items-center justify-between rounded-[2px] border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-surface-alt focus:outline-none"
            >
              <div>
                <p className="text-[12px] font-medium text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{svc.serviceName}</p>
                <p className="text-[10px] text-ink-quaternary">{svc.repoUrl}</p>
              </div>
              <ChevronRight size={13} className="text-ink-quaternary" />
            </button>
          ))}
        </div>
      </div>

      {/* Service name + runtime */}
      {(state.serviceName || detected) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-ink-secondary mb-1.5">Service name</label>
            <input
              type="text"
              value={state.serviceName}
              onChange={(e) => onChange({ serviceName: e.target.value })}
              className="w-full rounded-[2px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div>
            <label className="block text-[11px] text-ink-secondary mb-1.5">Runtime</label>
            <select
              value={state.runtime}
              onChange={(e) => onChange({ runtime: e.target.value })}
              className="w-full rounded-[2px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            >
              {RUNTIME_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="flex items-center gap-2 rounded-[2px] bg-ink px-5 py-2 text-[13px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        Next: configure rollout
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

// ─── Step 2: Configure ─────────────────────────────────────────────────────

function Step2({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Configure rollout policy</h2>
        <p className="text-[12px] text-ink-tertiary">
          These settings will be committed as <code className="font-mono text-ink">.deploytitan/{state.serviceName}.yaml</code> into your repo.
        </p>
      </div>

      {/* Strategy selector */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.1em] text-ink-tertiary mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rollout strategy</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['canary', 'blue-green', 'ring'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ strategy: s })}
              className={[
                'rounded-[2px] border px-4 py-3 text-left transition-colors focus:outline-none',
                state.strategy === s
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line bg-surface text-ink hover:border-primary/30 hover:bg-surface-alt',
              ].join(' ')}
            >
              <p className="text-[12px] font-semibold mb-0.5">{STRATEGY_INFO[s]?.label}</p>
              <p className={`text-[10px] leading-relaxed ${state.strategy === s ? 'text-surface/70' : 'text-ink-tertiary'}`}>
                {STRATEGY_INFO[s]?.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* SLO thresholds */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.1em] text-ink-tertiary mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>SLO gates</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Error rate threshold (%)"
            value={state.errorRateThreshold}
            onChange={(v) => onChange({ errorRateThreshold: v })}
            placeholder="0.5"
            hint="Promote auto-rolls back if exceeded"
          />
          <FormField
            label="p99 latency threshold (ms)"
            value={state.p99Threshold}
            onChange={(v) => onChange({ p99Threshold: v })}
            placeholder="300"
            hint="Any window in the promotion period"
          />
          {state.strategy === 'canary' && (
            <>
              <FormField
                label="Initial canary weight (%)"
                value={state.initialWeight}
                onChange={(v) => onChange({ initialWeight: v })}
                placeholder="10"
                hint="Traffic % for the first cohort"
              />
              <FormField
                label="Promotion window (min)"
                value={state.promotionWindow}
                onChange={(v) => onChange({ promotionWindow: v })}
                placeholder="10"
                hint="How long to wait before auto-promote"
              />
            </>
          )}
        </div>
      </section>

      {/* Feature toggles */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.1em] text-ink-tertiary mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Features</p>
        <div className="space-y-3">
          <FeatureToggle
            icon={<GitPullRequest size={14} />}
            title="Titan Foresight"
            description="Analyze every PR for blast radius and rollout risk before deployment."
            enabled={state.foresightEnabled}
            onToggle={() => onChange({ foresightEnabled: !state.foresightEnabled })}
          />
          {state.foresightEnabled && (
            <div className="ml-8 space-y-2 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.blockOnHighRisk}
                  onChange={() => onChange({ blockOnHighRisk: !state.blockOnHighRisk })}
                  className="rounded-[1px]"
                />
                <span className="text-[12px] text-ink-secondary">Block deployments on high-risk PRs</span>
              </label>
              <div>
                <label className="block text-[11px] text-ink-secondary mb-1">Slack channel for alerts</label>
                <input
                  type="text"
                  value={state.slackChannel}
                  onChange={(e) => onChange({ slackChannel: e.target.value })}
                  placeholder="#deployments"
                  className="rounded-[2px] border border-line bg-surface px-3 py-1.5 text-[12px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
            </div>
          )}

          <FeatureToggle
            icon={<RotateCcw size={14} />}
            title="Titan Phoenix"
            description="Automatic rollback on SLO breach. Cohort-scoped recovery in seconds."
            enabled={state.phoenixEnabled}
            onToggle={() => onChange({ phoenixEnabled: !state.phoenixEnabled })}
          />
          {state.phoenixEnabled && (
            <div className="ml-8 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.autoRollback}
                  onChange={() => onChange({ autoRollback: !state.autoRollback })}
                  className="rounded-[1px]"
                />
                <span className="text-[12px] text-ink-secondary">Auto-rollback (no manual confirmation)</span>
              </label>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-[2px] border border-line px-4 py-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none">
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 rounded-[2px] bg-ink px-5 py-2 text-[13px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        >
          Review changes
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Diff viewer ───────────────────────────────────────────────────

function Step3({
  state,
  diff,
  onNext,
  onBack,
  isOpening,
}: {
  state: WizardState
  diff: DemoIaCDiff[]
  onNext: () => void
  onBack: () => void
  isOpening: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('dt_live_demo_••••••••••').catch((err) => {
      console.error('[IntegrationPage] clipboard copy failed', err)
      logFrontendEvent({ level: 'error', message: 'clipboard.copy.failed', context: { error: err, location: 'IntegrationPage' } })
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Review changes</h2>
        <p className="text-[12px] text-ink-tertiary">
          The following files will be committed to <span className="font-mono text-ink">{state.repoUrl.replace('https://github.com/', '')}</span> via a pull request.
        </p>
      </div>

      {/* Diff viewer */}
      <div className="space-y-4">
        {diff.map((file) => (
          <DiffFile key={file.filename} file={file} />
        ))}
      </div>

      {/* Secret setup note */}
      <div className="rounded-[2px] border border-amber-200/60 bg-amber-50/40 dark:border-amber-400/20 dark:bg-amber-400/5 p-4">
        <p className="text-[12px] font-medium text-ink mb-2">Add your API key as a GitHub secret</p>
        <p className="text-[11px] text-ink-tertiary mb-3">
          The workflow references <code className="font-mono text-ink">DEPLOYTITAN_API_KEY</code>. Add it to your repo secrets before merging.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-[2px] border border-line bg-surface px-3 py-1.5 text-[11px] text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            dt_live_demo_••••••••••
          </code>
          <button
            onClick={handleCopyApiKey}
            className="flex items-center gap-1.5 rounded-[2px] border border-line px-3 py-1.5 text-[11px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
          >
            {copied ? <CheckCheck size={12} className="text-signal-success" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy key'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onBack} disabled={isOpening} className="rounded-[2px] border border-line px-4 py-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink disabled:opacity-40 focus:outline-none">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={isOpening}
          className="flex items-center gap-2 rounded-[2px] bg-ink px-5 py-2 text-[13px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        >
          {isOpening && <Loader2 size={13} className="animate-spin" />}
          {isOpening ? 'Opening PR…' : (
            <>
              <GitPullRequest size={14} />
              Open PR on GitHub
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Success ───────────────────────────────────────────────────────

function Step4({ state }: { state: WizardState }) {
  const { orgId: orgSlug, projectId: projectSlug } = useParams({ strict: false }) as { orgId?: string; projectId?: string }
  const fakeNumber = 1000 + Math.floor(Math.random() * 900)
  const repoShort = state.repoUrl.replace('https://github.com/', '')

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex flex-col items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-success/10 border border-signal-success/30">
          <CheckCircle2 size={24} className="text-signal-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink mb-1">PR opened successfully</h2>
          <p className="text-[12px] text-ink-tertiary">
            Pull request <span className="text-ink font-medium">#{fakeNumber}</span> has been opened on{' '}
            <a href={state.repoUrl} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2 hover:text-primary transition-colors">
              {repoShort}
            </a>.
          </p>
        </div>
      </div>

      {/* PR link card */}
      <div className="rounded-[2px] border border-line bg-surface px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <GitPullRequest size={16} className="text-signal-success" />
          <div>
            <p className="text-[13px] font-medium text-ink">chore: add DeployTitan integration for {state.serviceName}</p>
            <p className="text-[11px] text-ink-tertiary">{repoShort} · PR #{fakeNumber} · opened just now</p>
          </div>
        </div>
        <a
          href={`${state.repoUrl}/pull/${fakeNumber}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink transition-colors"
        >
          View PR on GitHub
          <ExternalLink size={11} />
        </a>
      </div>

      {/* What happens next */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.1em] text-ink-tertiary mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>What happens next</p>
        <ol className="space-y-3">
          {[
            { icon: <ShieldCheck size={14} />, text: 'Merge the PR — DeployTitan starts observing your CI/CD pipeline.' },
            { icon: <GitPullRequest size={14} />, text: 'On your next PR, Titan Foresight will post a risk analysis as a PR comment.' },
            { icon: <Zap size={14} />, text: 'On merge to main, Titan Rollout will deploy using your configured strategy and SLO gates.' },
            { icon: <RotateCcw size={14} />, text: 'If an SLO is breached, Titan Phoenix automatically rolls back within seconds.' },
          ].map(({ icon, text }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-surface-alt border border-line text-ink-tertiary">
                {icon}
              </span>
              <p className="text-[12px] text-ink-tertiary leading-relaxed pt-0.5">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex items-center gap-3">
        {orgSlug && projectSlug ? (
          <Link
            to="/orgs/$orgId/projects/$projectId/overview"
            params={{ orgId: orgSlug, projectId: projectSlug }}
            className="flex items-center gap-2 rounded-[2px] bg-ink px-5 py-2 text-[13px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            Go to Services
            <ArrowRight size={14} />
          </Link>
        ) : (
          <Link
            to="/overview"
            className="flex items-center gap-2 rounded-[2px] bg-ink px-5 py-2 text-[13px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            Go to Overview
            <ArrowRight size={14} />
          </Link>
        )}
        {orgSlug && projectSlug ? (
          <Link
            to="/orgs/$orgId/projects/$projectId/integrate"
            params={{ orgId: orgSlug, projectId: projectSlug }}
            className="rounded-[2px] border border-line px-4 py-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
          >
            Integrate another service
          </Link>
        ) : (
          <Link
            to="/overview"
            className="rounded-[2px] border border-line px-4 py-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink focus:outline-none"
          >
            Integrate another service
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Shared form primitives ────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-[11px] text-ink-secondary mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[2px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      />
      {hint && <p className="mt-1 text-[10px] text-ink-quaternary">{hint}</p>}
    </div>
  )
}

function FeatureToggle({
  icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'w-full flex items-start gap-3 rounded-[2px] border px-4 py-3 text-left transition-colors focus:outline-none',
        enabled ? 'border-ink/30 bg-surface' : 'border-line bg-surface hover:border-primary/20 hover:bg-surface-alt',
      ].join(' ')}
    >
      <span className={`mt-0.5 shrink-0 ${enabled ? 'text-ink' : 'text-ink-quaternary'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-ink mb-0.5">{title}</p>
        <p className="text-[11px] text-ink-tertiary leading-relaxed">{description}</p>
      </div>
        <div className={`shrink-0 mt-1 h-5 w-9 rounded-full relative transition-colors ${enabled ? 'bg-signal-success/80' : 'bg-line'}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
      </div>
    </button>
  )
}

// ─── Diff file viewer ─────────────────────────────────────────────────────

function DiffFile({ file }: { file: DemoIaCDiff }) {
  const [collapsed, setCollapsed] = useState(false)
  const addCount = file.hunks.flatMap((h) => h.lines).filter((l) => l.kind === 'add').length
  const delCount = file.hunks.flatMap((h) => h.lines).filter((l) => l.kind === 'del').length

  return (
    <div className="rounded-[2px] border border-line overflow-hidden">
      {/* File header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-alt hover:bg-surface border-b border-line transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          {collapsed ? <Circle size={12} className="text-ink-quaternary" /> : <CheckCircle2 size={12} className="text-signal-success" />}
          <span className="text-[12px] font-medium text-ink" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{file.filename}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {addCount > 0 && <span className="text-signal-success">+{addCount}</span>}
          {delCount > 0 && <span className="text-signal-danger">−{delCount}</span>}
        </div>
      </button>

      {/* Diff body */}
      {!collapsed && (
        <div className="overflow-x-auto bg-ink dark:bg-ink/95">
          {file.hunks.map((hunk, hi) => (
            <div key={hi}>
              <div className="px-4 py-1 bg-primary/10 text-[10px] text-primary-muted" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {hunk.header}
              </div>
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={[
                    'flex px-4 py-0.5 text-[11px]',
                    line.kind === 'add' ? 'bg-signal-success/10 text-signal-success' :
                    line.kind === 'del' ? 'bg-signal-danger/10 text-signal-danger' :
                    'text-ink-tertiary',
                  ].join(' ')}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  <span className="mr-3 select-none text-ink-quaternary w-3">
                    {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}
                  </span>
                  <span>{line.content}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root component ────────────────────────────────────────────────────────

const DEFAULT_STATE: WizardState = {
  repoUrl: '',
  serviceName: '',
  runtime: 'Node.js 22 LTS',
  strategy: 'canary',
  errorRateThreshold: '0.5',
  p99Threshold: '300',
  initialWeight: '10',
  promotionWindow: '10',
  foresightEnabled: true,
  phoenixEnabled: true,
  autoRollback: true,
  blockOnHighRisk: false,
  slackChannel: '#deployments',
}

export function IntegrationPage() {
  const search = useSearch({ from: '/_protected/_console/orgs/$orgId/projects/$projectId/integrate' })
  const navigate = useNavigate({ from: '/orgs/$orgId/projects/$projectId/integrate' })

  const prefilledService = search.service ?? null
  const step = Number(search.step ?? 1) as Step
  const setStep = (s: Step) => navigate({ search: (prev) => ({ ...prev, step: s }) })

  const [state, setState] = useState<WizardState>(() => {
    if (prefilledService) {
      const match = DEMO_SERVICES.find((s) => s.serviceName === prefilledService)
      return {
        ...DEFAULT_STATE,
        serviceName: prefilledService,
        repoUrl: match?.repoUrl ?? '',
        runtime: match?.runtime ?? DEFAULT_STATE.runtime,
      }
    }
    return DEFAULT_STATE
  })
  const [diff, setDiff] = useState<DemoIaCDiff[]>([])
  const [isOpening, setIsOpening] = useState(false)

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }))

  const goToStep3 = () => {
    const generated = buildIaCDiff({
      serviceName: state.serviceName,
      strategy: state.strategy,
      errorRateThreshold: state.errorRateThreshold,
      p99Threshold: state.p99Threshold,
      initialWeight: state.initialWeight,
      promotionWindow: state.promotionWindow,
      repo: state.repoUrl,
      runtime: state.runtime,
    })
    setDiff(generated)
    setStep(3)
  }

  const openPR = () => {
    setIsOpening(true)
    setTimeout(() => {
      setIsOpening(false)
      setStep(4)
    }, 1800)
  }

  const STEP_LABELS = ['Connect repo', 'Configure', 'Review diff', 'Done']

  return (
    <div className="px-8 py-10 animate-fade-up">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold tracking-tight text-ink mb-1"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
        >
          Integration wizard
        </h1>
        <p className="text-[12px] text-ink-tertiary">
          Connect a service repo in 3 steps — we'll open a PR with the full IaC config.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step
          const done = n < step
          const active = n === step
          return (
            <div key={n} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors shrink-0',
                  done   ? 'bg-signal-success text-surface' :
                  active ? 'bg-ink text-surface' :
                  'bg-surface border border-line text-ink-quaternary',
                ].join(' ')}>
                  {done ? <CheckCircle2 size={14} /> : n}
                </div>
                <span className={`text-[12px] hidden sm:block ${active ? 'text-ink font-medium' : done ? 'text-ink-tertiary' : 'text-ink-quaternary'}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-8 sm:w-12 mx-2 ${done ? 'bg-signal-success' : 'bg-line'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      {step === 1 && <Step1 state={state} onChange={patch} onNext={() => setStep(2)} />}
      {step === 2 && <Step2 state={state} onChange={patch} onNext={goToStep3} onBack={() => setStep(1)} />}
      {step === 3 && <Step3 state={state} diff={diff} onNext={openPR} onBack={() => setStep(2)} isOpening={isOpening} />}
      {step === 4 && <Step4 state={state} />}
    </div>
  )
}
