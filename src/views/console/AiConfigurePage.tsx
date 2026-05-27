'use client'

/**
 * AiConfigurePage — conversational AI configuration interface.
 * Route: /orgs/:orgSlug/projects/:projectSlug/configure
 *
 * Flow:
 *   1. Empty state: page header + 6 example prompt chips + fixed input bar
 *   2. User sends a prompt → user bubble appears, AI "thinking" indicator
 *   3. AI responds with a clarifying question or an inline editable config form
 *   4. User fills/edits the form and clicks "Save configuration"
 *   5. Form collapses to a confirmation card with a "View in [Product]" link
 *
 * Design notes:
 * - Product register (console). Restrained color strategy: tinted neutrals,
 *   amber used only for the active send button and saved-config accent.
 * - Light mode only for this surface (morning / onboarding context).
 * - rounded-[4px] on containers; rounded-[2px] on badges (§7.1).
 * - All animations use shared animate-* utilities (§7.2).
 * - No hero-metric tile grids (§7.3).
 * - No gradient text, no glassmorphism, no side-stripe borders.
 * - JetBrains Mono strictly for machine-originated content.
 * - Conversation is demo-mode only (no backend). State lives in component.
 */

import { useRef, useState, useEffect, useId } from 'react'
import { useParams, useNavigate } from '@/lib/navigation'
import {
  ArrowUp,
  Check,
  ExternalLink,
  Sparkles,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'ai'

interface UserMessage {
  id: string
  role: 'user'
  text: string
}

interface AiThinkingMessage {
  id: string
  role: 'ai'
  kind: 'thinking'
}

interface AiQuestionMessage {
  id: string
  role: 'ai'
  kind: 'question'
  text: string
}

interface AiConfigMessage {
  id: string
  role: 'ai'
  kind: 'config'
  config: GeneratedConfig
  saved: boolean
}

interface AiErrorMessage {
  id: string
  role: 'ai'
  kind: 'error'
  text: string
}

type Message =
  | UserMessage
  | AiThinkingMessage
  | AiQuestionMessage
  | AiConfigMessage
  | AiErrorMessage

// ─── Config model ─────────────────────────────────────────────────────────────

type ProductTarget =
  | 'rollouts'
  | 'policies'
  | 'rollback'
  | 'integrate'
  | 'foresight'
  | 'ledger'

interface ConfigField {
  key: string
  label: string
  description?: string
  type: 'text' | 'number' | 'select' | 'toggle' | 'multiselect'
  value: string | number | boolean | string[]
  options?: { value: string; label: string }[]
  unit?: string
  min?: number
  max?: number
}

interface GeneratedConfig {
  id: string
  title: string
  summary: string
  product: ProductTarget
  productLabel: string
  fields: ConfigField[]
}

// ─── Demo AI response engine ──────────────────────────────────────────────────

const PRODUCT_LABELS: Record<ProductTarget, string> = {
  rollouts:  'Titan Rollout',
  policies:  'Titan Shield',
  rollback:  'Titan Phoenix',
  integrate: 'Titan Ledger',
  foresight: 'Titan Foresight',
  ledger:    'Titan Ledger',
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function interpretPrompt(text: string): GeneratedConfig | { question: string } | { error: string } {
  const lower = text.toLowerCase()

  // Canary / rollout
  if (lower.includes('canary') || lower.includes('rollout') || lower.includes('traffic split') || lower.includes('progressive')) {
    const pctMatch = lower.match(/(\d+)\s*%/)
    const pct = pctMatch ? parseInt(pctMatch[1] as string) : 5
    const serviceMatch = text.match(/for\s+(?:my\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+service|\s+at|\s+with|$)/i)
    const serviceName = serviceMatch?.[1]?.trim() ?? 'api-service'
    return {
      id: uid(),
      title: `Canary rollout — ${serviceName}`,
      summary: `Progressive canary deployment starting at ${pct}% traffic`,
      product: 'rollouts',
      productLabel: PRODUCT_LABELS.rollouts,
      fields: [
        { key: 'serviceName',      label: 'Service name',      type: 'text',   value: serviceName, description: 'The service this rollout policy applies to' },
        { key: 'strategy',         label: 'Strategy',          type: 'select', value: 'canary', options: [{ value: 'canary', label: 'Canary' }, { value: 'blue-green', label: 'Blue-Green' }, { value: 'ring', label: 'Ring' }] },
        { key: 'initialWeight',    label: 'Initial traffic',   type: 'number', value: pct,    unit: '%',   min: 1,  max: 50,  description: 'Percentage of traffic routed to the new version initially' },
        { key: 'stepIncrement',    label: 'Step increment',    type: 'number', value: 10,    unit: '%',   min: 1,  max: 50 },
        { key: 'promotionWindow',  label: 'Promotion window',  type: 'number', value: 30,    unit: 'min', min: 5,           description: 'How long to observe before auto-promoting to the next step' },
        { key: 'maxErrorRate',     label: 'Max error rate',    type: 'number', value: 1.0,   unit: '%',   min: 0.1,         description: 'Halt promotion and trigger rollback if error rate exceeds this' },
        { key: 'maxP99',           label: 'Max p99 latency',   type: 'number', value: 500,   unit: 'ms',  min: 50 },
        { key: 'smokeTesting',     label: 'Require smoke tests',   type: 'toggle', value: true },
      ],
    }
  }

  // Rollback / shield
  if (lower.includes('rollback') || lower.includes('auto-rollback') || lower.includes('error rate') || lower.includes('shield')) {
    const rateMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/)
    const threshold = rateMatch ? parseFloat(rateMatch[1] as string) : 2
    return {
      id: uid(),
      title: 'Auto-rollback policy',
      summary: `Trigger automatic rollback when error rate exceeds ${threshold}%`,
      product: 'policies',
      productLabel: PRODUCT_LABELS.policies,
      fields: [
        { key: 'policyName',       label: 'Policy name',          type: 'text',        value: 'Auto-rollback — error rate' },
        { key: 'autoRollback',     label: 'Auto rollback',        type: 'toggle',      value: true, description: 'Automatically roll back when a trigger fires' },
        { key: 'errorThreshold',   label: 'Error rate threshold', type: 'number',      value: threshold, unit: '%', min: 0.1, max: 50, description: 'Rollback triggers when error rate exceeds this value' },
        { key: 'triggerConditions',label: 'Trigger conditions',   type: 'multiselect', value: ['error_rate_spike'], options: [{ value: 'error_rate_spike', label: 'Error rate spike' }, { value: 'p99_breach', label: 'p99 latency breach' }, { value: 'health_check_fail', label: 'Health-check failures' }] },
        { key: 'cooldown',         label: 'Cooldown period',      type: 'number',      value: 15,   unit: 'min', min: 1,   description: 'Minimum time between consecutive rollbacks for the same service' },
        { key: 'notifySlack',      label: 'Notify via Slack',     type: 'toggle',      value: true },
        { key: 'phoenixEnabled',   label: 'Enable Phoenix mode',  type: 'toggle',      value: false, description: 'Phoenix automatically rewrites the failed commit and opens a fix PR' },
      ],
    }
  }

  // Sandbox / preview
  if (lower.includes('sandbox') || lower.includes('preview') || lower.includes('staging') || lower.includes('pr preview')) {
    return {
      id: uid(),
      title: 'PR preview environment',
      summary: 'Spin up isolated sandbox environments for pull request previews',
      product: 'rollouts',
      productLabel: PRODUCT_LABELS.rollouts,
      fields: [
        { key: 'envName',          label: 'Environment name',     type: 'text',   value: 'pr-preview', description: 'Identifier for the preview environment type' },
        { key: 'triggerOn',        label: 'Trigger on',           type: 'select', value: 'pr_open', options: [{ value: 'pr_open', label: 'PR opened or updated' }, { value: 'pr_labeled', label: 'PR labeled "preview"' }, { value: 'manual', label: 'Manual trigger only' }] },
        { key: 'ttl',              label: 'Environment TTL',      type: 'number', value: 24,  unit: 'hr',  min: 1, description: 'Sandbox is automatically torn down after this duration' },
        { key: 'autoTeardown',     label: 'Auto-teardown on merge', type: 'toggle', value: true },
        { key: 'isolatedDatabase', label: 'Isolated database',    type: 'toggle', value: false, description: 'Provision a separate database for each PR preview' },
      ],
    }
  }

  // Slack / notifications / alerts
  if (lower.includes('slack') || lower.includes('alert') || lower.includes('notify') || lower.includes('notification') || lower.includes('pagerduty')) {
    return {
      id: uid(),
      title: 'Deployment alerts',
      summary: 'Send deployment events and failure alerts to your team',
      product: 'integrate',
      productLabel: PRODUCT_LABELS.integrate,
      fields: [
        { key: 'channel',          label: 'Slack channel',        type: 'text',   value: '#deployments', description: 'The Slack channel that receives deployment events' },
        { key: 'notifyOn',         label: 'Notify on',            type: 'multiselect', value: ['deploy_failed', 'rollback_triggered'], options: [{ value: 'deploy_started', label: 'Deployment started' }, { value: 'deploy_completed', label: 'Deployment completed' }, { value: 'deploy_failed', label: 'Deployment failed' }, { value: 'rollback_triggered', label: 'Rollback triggered' }, { value: 'canary_stalled', label: 'Canary stalled' }] },
        { key: 'mentionOnFailure', label: 'Mention @here on failure', type: 'toggle', value: true },
        { key: 'includeDiff',      label: 'Include commit diff',  type: 'toggle', value: false },
      ],
    }
  }

  // Deploy freeze / window
  if (lower.includes('freeze') || lower.includes('window') || lower.includes('weekend') || lower.includes('block')) {
    return {
      id: uid(),
      title: 'Deploy freeze window',
      summary: 'Block deployments during specified periods',
      product: 'policies',
      productLabel: PRODUCT_LABELS.policies,
      fields: [
        { key: 'windowName',       label: 'Window name',          type: 'text',   value: 'Weekend freeze', description: 'A label for this freeze window' },
        { key: 'schedule',         label: 'Schedule',             type: 'select', value: 'weekends', options: [{ value: 'weekends', label: 'Weekends (Sat–Sun UTC)' }, { value: 'nights', label: 'Nights (20:00–08:00 UTC)' }, { value: 'custom', label: 'Custom cron' }] },
        { key: 'emergencyOverride',label: 'Allow emergency override', type: 'toggle', value: true, description: 'Admins can bypass the freeze window with an explicit override reason' },
        { key: 'notifyOnAttempt', label: 'Notify on blocked attempt', type: 'toggle', value: true },
      ],
    }
  }

  // Foresight / risk / analyze
  if (lower.includes('risk') || lower.includes('foresight') || lower.includes('analyze') || lower.includes('pr') || lower.includes('analyze risk')) {
    return {
      id: uid(),
      title: 'Automated deployment risk analysis',
      summary: 'Analyze every PR for deployment risk before it merges',
      product: 'foresight',
      productLabel: PRODUCT_LABELS.foresight,
      fields: [
        { key: 'enableAutoAnalysis', label: 'Auto-analyze on PR open', type: 'toggle', value: true, description: 'Titan Foresight runs risk analysis as soon as a PR is opened or updated' },
        { key: 'blockHighRisk',    label: 'Block merges with HIGH risk', type: 'toggle', value: false, description: 'Require manual override to merge a PR scored HIGH risk' },
        { key: 'riskThreshold',    label: 'Risk score threshold',     type: 'select', value: 'medium', options: [{ value: 'low', label: 'Low (always block)' }, { value: 'medium', label: 'Medium (warn on medium+)' }, { value: 'high', label: 'High (only block critical)' }] },
        { key: 'postComments',     label: 'Post risk summary as PR comment', type: 'toggle', value: true },
        { key: 'trackChangedFiles',label: 'Track high-risk file patterns', type: 'toggle', value: true, description: 'Flag PRs that modify known blast-radius files (DB migrations, auth, billing)' },
      ],
    }
  }

  // Ambiguous — ask a question
  if (lower.length < 20) {
    return {
      question: "Can you give me a bit more detail? For example: which service, what kind of configuration (rollout, rollback, alerts, sandbox), and any specific thresholds you have in mind.",
    }
  }

  return {
    error: "I wasn't able to map that to a configuration. Try being more specific, for example: \"set up a canary rollout for my payments service at 5%\" or \"create an auto-rollback policy that triggers when error rate exceeds 2%\".",
  }
}

// ─── Example prompts ──────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  { label: 'Canary rollout at 5%',       text: 'Set up a canary rollout for my API service at 5% traffic' },
  { label: 'Auto-rollback on errors',    text: 'Create a rollback policy that triggers when error rate exceeds 2%' },
  { label: 'PR preview environments',    text: 'Add a sandbox environment for staging PR previews' },
  { label: 'Slack deployment alerts',    text: 'Alert my team on Slack when a deployment fails' },
  { label: 'Weekend deploy freeze',      text: 'Set a deploy freeze window for weekends' },
  { label: 'Automated risk analysis',    text: 'Analyze risk for my next deployment automatically' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children, description }: { children: React.ReactNode; description?: string | undefined }) {
  return (
    <div className="mb-1.5">
      <label
        className="block text-[10px] font-medium text-ink-quaternary uppercase tracking-[0.08em]"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {children}
      </label>
      {description && (
        <p className="mt-0.5 text-[11px] text-ink-quaternary leading-snug">{description}</p>
      )}
    </div>
  )
}

function ConfigFieldInput({
  field,
  onChange,
}: {
  field: ConfigField
  onChange: (key: string, value: ConfigField['value']) => void
}) {
  if (field.type === 'toggle') {
    const checked = field.value as boolean
    return (
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(field.key, !checked)}
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
        <span className="text-[13px] text-ink">{checked ? 'Enabled' : 'Disabled'}</span>
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <select
        value={field.value as string}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={[
          'rounded-[4px] border border-line bg-surface px-2.5 py-1.5',
          'text-[13px] text-ink',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
          'transition-colors duration-150',
        ].join(' ')}
      >
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'multiselect') {
    const selected = field.value as string[]
    return (
      <div className="flex flex-col gap-2">
        {field.options?.map((opt) => {
          const isSelected = selected.includes(opt.value)
          return (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <span
                className={[
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-150',
                  isSelected
                    ? 'bg-ink border-ink'
                    : 'bg-surface border-ink-quaternary group-hover:border-ink-tertiary',
                ].join(' ')}
                onClick={() => {
                  onChange(field.key, isSelected
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value]
                  )
                }}
              >
                {isSelected && <Check size={10} strokeWidth={3} className="text-surface" />}
              </span>
              <span className="text-[13px] text-ink">{opt.label}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={field.value as number}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(field.key, parseFloat(e.target.value) || 0)}
          className={[
            'w-24 rounded-[4px] border border-line bg-surface px-2.5 py-1.5',
            'text-[13px] text-ink',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
            'transition-colors duration-150',
          ].join(' ')}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        />
        {field.unit && (
          <span
            className="text-[11px] text-ink-tertiary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {field.unit}
          </span>
        )}
      </div>
    )
  }

  // text
  return (
    <input
      type="text"
      value={field.value as string}
      onChange={(e) => onChange(field.key, e.target.value)}
      className={[
        'w-full max-w-sm rounded-[4px] border border-line bg-surface px-2.5 py-1.5',
        'text-[13px] text-ink placeholder:text-ink-quaternary',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
        'transition-colors duration-150',
      ].join(' ')}
    />
  )
}

// ─── Inline config form (rendered inside AI bubble) ───────────────────────────

function InlineConfigForm({
  config,
  onSave,
}: {
  config: GeneratedConfig
  onSave: (config: GeneratedConfig) => void
}) {
  const [fields, setFields] = useState<ConfigField[]>(config.fields)
  const [saving, setSaving] = useState(false)

  const updateField = (key: string, value: ConfigField['value']) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)))
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 900))
    onSave({ ...config, fields })
    setSaving(false)
  }

  return (
    <div className="mt-3 rounded-[4px] border border-line bg-surface overflow-hidden animate-slide-down">
      {/* Form header */}
      <div className="px-4 py-3 border-b border-line bg-surface-alt flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">{config.title}</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">{config.summary}</p>
        </div>
        <span
          className="shrink-0 rounded-[2px] border border-primary/30 bg-primary-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-primary-dark"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {config.productLabel}
        </span>
      </div>

      {/* Fields */}
      <div className="px-4 py-4 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <FieldLabel description={field.description}>{field.label}</FieldLabel>
            <ConfigFieldInput field={field} onChange={updateField} />
          </div>
        ))}
      </div>

      {/* Save action */}
      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={[
            'inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-[12px] font-medium transition-all duration-150',
            saving
              ? 'bg-ink/60 text-surface cursor-not-allowed'
              : 'bg-ink text-surface hover:opacity-80',
          ].join(' ')}
        >
          {saving ? (
            <>
              <span
                className="inline-block h-3 w-3 rounded-full border-2 border-surface/30 border-t-surface animate-spin"
              />
              Saving...
            </>
          ) : (
            <>
              <Check size={12} strokeWidth={2.5} />
              Save configuration
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Saved confirmation card ──────────────────────────────────────────────────

function SavedCard({
  config,
  orgSlug,
  projectSlug,
}: {
  config: GeneratedConfig
  orgSlug: string
  projectSlug: string
}) {
  const to = `/orgs/${orgSlug}/projects/${projectSlug}/${config.product}`

  return (
    <div className="mt-3 rounded-[4px] border border-signal-success/20 bg-signal-success/5 px-4 py-3 flex items-start gap-3 animate-fade-in">
      <div className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-signal-success/15">
        <Check size={11} strokeWidth={2.5} className="text-signal-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-ink">
          {config.title} saved to {config.productLabel}.
        </p>
        <p className="text-[11px] text-ink-tertiary mt-0.5">
          You can review and adjust it anytime.
        </p>
      </div>
      <a
        href={to}
        className="shrink-0 inline-flex items-center gap-1 rounded-[4px] border border-line px-2.5 py-1 text-[11px] text-ink-secondary hover:text-ink hover:border-ink/30 transition-colors duration-150 whitespace-nowrap"
      >
        View in {config.productLabel}
        <ExternalLink size={10} strokeWidth={1.75} />
      </a>
    </div>
  )
}

// ─── Message bubbles ──────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[72%] rounded-[4px] bg-ink px-3.5 py-2.5">
        <p className="text-[13px] text-surface leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  )
}

function AiBubbleWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-[4px] border border-line bg-surface-alt">
        <Sparkles size={12} strokeWidth={1.5} className="text-primary-dark" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">{children}</div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <AiBubbleWrapper>
      <div className="flex items-center gap-1.5 py-1">
        <span
          className="text-[11px] text-ink-tertiary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Analyzing your request
        </span>
        <span className="flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="block h-1 w-1 rounded-full bg-ink-quaternary animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </AiBubbleWrapper>
  )
}

function QuestionBubble({ text }: { text: string }) {
  return (
    <AiBubbleWrapper>
      <p className="text-[13px] text-ink leading-relaxed">{text}</p>
    </AiBubbleWrapper>
  )
}

function ConfigBubble({
  message,
  onSave,
  orgSlug,
  projectSlug,
}: {
  message: AiConfigMessage
  onSave: (id: string, config: GeneratedConfig) => void
  orgSlug: string
  projectSlug: string
}) {
  return (
    <AiBubbleWrapper>
      <p className="text-[13px] text-ink leading-relaxed">
        Here's a configuration based on your request. Review the fields below and save when ready.
      </p>
      {message.saved ? (
        <SavedCard config={message.config} orgSlug={orgSlug} projectSlug={projectSlug} />
      ) : (
        <InlineConfigForm
          config={message.config}
          onSave={(cfg) => onSave(message.id, cfg)}
        />
      )}
    </AiBubbleWrapper>
  )
}

function ErrorBubble({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <AiBubbleWrapper>
      <div className="flex items-start gap-2">
        <AlertCircle size={13} strokeWidth={1.5} className="text-signal-danger mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] text-ink leading-relaxed">{text}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-tertiary hover:text-ink transition-colors duration-150"
          >
            <RotateCcw size={10} strokeWidth={2} />
            Try again
          </button>
        </div>
      </div>
    </AiBubbleWrapper>
  )
}

// ─── Empty state prompt chips ─────────────────────────────────────────────────

function PromptChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-[4px] border border-line bg-surface-alt mb-4">
            <Sparkles size={18} strokeWidth={1.25} className="text-primary-dark" />
          </div>
          <h2
            className="text-[20px] font-medium text-ink tracking-tight mb-2"
            style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.016em' }}
          >
            What do you want to set up?
          </h2>
          <p className="text-[13px] text-ink-tertiary max-w-md mx-auto leading-relaxed">
            Describe your goal in plain language. Titan will generate the right configuration and let you review before saving.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt.text}
              type="button"
              onClick={() => onSelect(prompt.text)}
              className={[
                'group rounded-[4px] border border-line bg-surface px-4 py-3 text-left',
                'hover:border-ink/20 hover:bg-surface-alt',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
              ].join(' ')}
            >
              <p className="text-[12px] font-medium text-ink-secondary group-hover:text-ink transition-colors duration-150">
                {prompt.label}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-quaternary leading-snug">
                {prompt.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AiConfigurePage() {
  const params = useParams({ strict: false }) as { orgId?: string; projectId?: string }
  const orgSlug = params.orgId ?? 'demo-org'
  const projectSlug = params.projectId ?? 'demo-project'

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [lastUserPrompt, setLastUserPrompt] = useState<string | null>(null)

  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()

  const isEmpty = messages.length === 0

  // Scroll thread to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages])

  const addMessage = (msg: Message) => setMessages((prev) => [...prev, msg])

  const removeThinking = () =>
    setMessages((prev) => prev.filter((m) => !(m.role === 'ai' && 'kind' in m && m.kind === 'thinking')))

  const handleSend = async (text: string = input.trim()) => {
    if (!text || isThinking) return

    setLastUserPrompt(text)
    setInput('')
    setIsThinking(true)

    addMessage({ id: uid(), role: 'user', text })

    // Fake thinking delay
    addMessage({ id: uid(), role: 'ai', kind: 'thinking' })

    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600))

    removeThinking()
    setIsThinking(false)

    const result = interpretPrompt(text)

    if ('question' in result) {
      addMessage({ id: uid(), role: 'ai', kind: 'question', text: result.question })
    } else if ('error' in result) {
      addMessage({ id: uid(), role: 'ai', kind: 'error', text: result.error })
    } else {
      addMessage({ id: uid(), role: 'ai', kind: 'config', config: result, saved: false })
    }

    // Restore focus to input
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleRetry = () => {
    if (lastUserPrompt) {
      // Remove the error message and resend
      setMessages((prev) => {
        const withoutLast = [...prev]
        // remove last AI error
        const lastAiIdx = [...withoutLast].reverse().findIndex(
          (m) => m.role === 'ai' && 'kind' in m && m.kind === 'error'
        )
        if (lastAiIdx !== -1) withoutLast.splice(withoutLast.length - 1 - lastAiIdx, 1)
        return withoutLast
      })
      handleSend(lastUserPrompt)
    }
  }

  const handleSaveConfig = (msgId: string, savedConfig: GeneratedConfig) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === 'ai' && 'kind' in m && m.kind === 'config'
          ? { ...m, config: savedConfig, saved: true }
          : m
      )
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasInput = input.trim().length > 0

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      {/* Page header */}
      <div className="shrink-0 px-8 pt-8 pb-0">
        <div className="max-w-2xl">
          <h1
            className="text-[22px] font-medium tracking-tight text-ink leading-none mb-1.5"
            style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
          >
            Configure with AI
          </h1>
          <p className="text-[12px] text-ink-tertiary">
            Describe what you want to set up and we'll handle the details.
          </p>
        </div>
        {/* Hairline divider */}
        <div className="mt-6 h-px bg-line" />
      </div>

      {/* Conversation thread or empty state */}
      {isEmpty ? (
        <PromptChips
          onSelect={(text) => {
            setInput(text)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
        />
      ) : (
        <div
          ref={threadRef}
          className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-5"
        >
          <div className="max-w-2xl space-y-5">
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return <UserBubble key={msg.id} text={msg.text} />
              }
              if (!('kind' in msg)) return null
              if (msg.kind === 'thinking') return <ThinkingBubble key={msg.id} />
              if (msg.kind === 'question') return <QuestionBubble key={msg.id} text={msg.text} />
              if (msg.kind === 'error') return <ErrorBubble key={msg.id} text={msg.text} onRetry={handleRetry} />
              if (msg.kind === 'config') {
                return (
                  <ConfigBubble
                    key={msg.id}
                    message={msg}
                    onSave={handleSaveConfig}
                    orgSlug={orgSlug}
                    projectSlug={projectSlug}
                  />
                )
              }
              return null
            })}
          </div>
        </div>
      )}

      {/* Fixed bottom input bar */}
      <div className="shrink-0 border-t border-line bg-surface px-8 py-4">
        <div className="max-w-2xl">
          <div
            className={[
              'flex items-end gap-2 rounded-[4px] border bg-surface transition-colors duration-150',
              hasInput ? 'border-ink/30' : 'border-line',
            ].join(' ')}
          >
            <label htmlFor={inputId} className="sr-only">
              Describe what you want to configure
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // auto-resize
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to configure..."
              rows={1}
              disabled={isThinking}
              className={[
                'flex-1 resize-none bg-transparent px-3.5 py-3 text-[13px] text-ink',
                'placeholder:text-ink-quaternary leading-relaxed',
                'focus:outline-none disabled:opacity-50',
                'min-h-[44px] max-h-[160px]',
              ].join(' ')}
              style={{ height: '44px' }}
            />
            <div className="shrink-0 p-2">
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!hasInput || isThinking}
                aria-label="Send message"
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-[4px] transition-all duration-150',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30',
                  hasInput && !isThinking
                    ? 'bg-primary text-ink cursor-pointer hover:bg-primary-dark'
                    : 'bg-line text-ink-quaternary cursor-not-allowed',
                ].join(' ')}
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-ink-quaternary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            Enter to send · Shift+Enter for new line · Configurations are saved to your project
          </p>
        </div>
      </div>
    </div>
  )
}
