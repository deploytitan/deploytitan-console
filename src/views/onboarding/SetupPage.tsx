'use client'

/**
 * SetupPage — DeployTitan GitHub App onboarding
 *
 * 4-step flow:
 *   1. Connect GitHub account (install DeployTitan GitHub App)
 *   2. Select repository
 *   3. Review + confirm IaC configuration (two-panel: detection tree / Terraform preview)
 *   4. Create PR to activate controller
 *
 * Layout reference: Revolte YML config screen (two-panel on step 3)
 * Design: DeployTitan Instrument Panel, light mode, Restrained color strategy
 */

import { useState, useCallback } from 'react'
import {
  CheckIcon,
  ChevronRightIcon,
  GitBranchIcon,
  SearchIcon,
  RefreshCwIcon,
  FileTextIcon,
  GitPullRequestIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  LoaderIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4

interface GitHubUser {
  login: string
}

interface Repo {
  id: number
  name: string
  fullName: string
  isPrivate: boolean
  pushedAt: string
  language: string | null
}

interface ScanResult {
  runtime: string
  containerized: boolean
  cloudProvider: string
  deployTarget: DeployTarget
  confidence: Record<string, 'high' | 'medium' | 'low'>
}

type DeployTarget = 'kubernetes' | 'lambda-edge' | 'cloud-run' | 'ecs'
type CloudProvider = 'aws' | 'gcp' | 'azure' | 'generic'

interface IaCConfig {
  deployTarget: DeployTarget
  cloudProvider: CloudProvider
  region: string
  clusterName: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_REPOS: Repo[] = [
  { id: 1, name: 'api-gateway', fullName: 'acme-corp/api-gateway', isPrivate: false, pushedAt: '2026-05-11', language: 'Go' },
  { id: 2, name: 'frontend', fullName: 'acme-corp/frontend', isPrivate: false, pushedAt: '2026-05-10', language: 'TypeScript' },
  { id: 3, name: 'auth-service', fullName: 'acme-corp/auth-service', isPrivate: true, pushedAt: '2026-05-09', language: 'TypeScript' },
  { id: 4, name: 'payments', fullName: 'acme-corp/payments', isPrivate: true, pushedAt: '2026-05-08', language: 'Python' },
  { id: 5, name: 'ml-pipeline', fullName: 'acme-corp/ml-pipeline', isPrivate: false, pushedAt: '2026-05-06', language: 'Python' },
  { id: 6, name: 'infra', fullName: 'acme-corp/infra', isPrivate: true, pushedAt: '2026-05-01', language: 'HCL' },
]

const MOCK_SCAN: ScanResult = {
  runtime: 'Node.js 20',
  containerized: true,
  cloudProvider: 'AWS',
  deployTarget: 'kubernetes',
  confidence: {
    runtime: 'high',
    containerized: 'high',
    cloudProvider: 'medium',
    deployTarget: 'high',
  },
}

// ---------------------------------------------------------------------------
// Terraform template generator
// ---------------------------------------------------------------------------

function generateTerraform(config: IaCConfig, repoName: string): Record<string, string> {
  const moduleSource: Record<DeployTarget, string> = {
    kubernetes: 'deploytitan/controller-k8s/kubernetes',
    'lambda-edge': 'deploytitan/controller-lambda/aws',
    'cloud-run': 'deploytitan/controller-cloudrun/google',
    ecs: 'deploytitan/controller-ecs/aws',
  }

  const clusterBlock = config.deployTarget === 'kubernetes'
    ? `  cluster_name = "${config.clusterName}"\n  namespace    = "deploytitan"`
    : `  region       = "${config.region}"`

  const mainTf = `terraform {
  required_version = ">= 1.6"

  required_providers {
    ${config.cloudProvider === 'gcp' ? 'google' : config.cloudProvider} = {
      source  = "hashicorp/${config.cloudProvider === 'gcp' ? 'google' : config.cloudProvider}"
      version = "~> 5.0"
    }
  }
}

module "deploytitan_controller" {
  source  = "${moduleSource[config.deployTarget]}"
  version = "~> 1.0"

  repository       = "${repoName}"
${clusterBlock}
  rollout_strategy = "canary"
  enable_rollback  = true
  enable_foresight = true
}

output "webhook_url" {
  description = "DeployTitan controller webhook endpoint"
  value       = module.deploytitan_controller.webhook_url
}

output "controller_iam_role" {
  description = "IAM role ARN for the controller"
  value       = module.deploytitan_controller.iam_role_arn
  sensitive   = true
}
`

  const variablesTf = `variable "deploytitan_token" {
  description = "DeployTitan API token. Set via TF_VAR_deploytitan_token."
  type        = string
  sensitive   = true
}
${config.deployTarget === 'kubernetes' ? `
variable "kubeconfig_path" {
  description = "Path to kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}` : ''}
`

  const outputsTf = `output "setup_complete" {
  description = "Set to true once the controller is healthy"
  value       = module.deploytitan_controller.healthy
}
`

  return {
    'main.tf': mainTf,
    'variables.tf': variablesTf,
    'outputs.tf': outputsTf,
  }
}

// ---------------------------------------------------------------------------
// Step progress track
// ---------------------------------------------------------------------------

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Connect GitHub' },
  { n: 2, label: 'Select repo' },
  { n: 3, label: 'Configure IaC' },
  { n: 4, label: 'Create PR' },
]

function StepTrack({ current }: { current: Step }) {
  return (
    <nav aria-label="Onboarding progress" className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = s.n < current
        const active = s.n === current
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-[2px] text-[10px] font-mono font-medium tracking-wider transition-colors duration-200',
                  done && 'bg-[var(--color-ink)] text-[var(--color-surface)]',
                  active && 'bg-[var(--color-gold)] text-[var(--color-ink)]',
                  !done && !active && 'border border-[var(--color-line)] text-[var(--color-ink-quaternary)]',
                )}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : s.n}
              </span>
              <span
                className={cn(
                  'text-xs font-medium transition-colors duration-200',
                  active && 'text-[var(--color-ink)]',
                  done && 'text-[var(--color-ink-secondary)]',
                  !done && !active && 'text-[var(--color-ink-quaternary)]',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRightIcon className="mx-3 h-3.5 w-3.5 text-[var(--color-line)]" />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Step 1: GitHub Connect
// ---------------------------------------------------------------------------

type ConnectStatus = 'idle' | 'pending' | 'done' | 'error'

function StepConnect({ onDone }: { onDone: (user: GitHubUser) => void }) {
  const [status, setStatus] = useState<ConnectStatus>('idle')

  const handleConnect = useCallback(() => {
    setStatus('pending')
    // In production: window.location.href = '/api/auth/github/install'
    setTimeout(() => {
      setStatus('done')
      onDone({ login: 'justinekizhak' })
    }, 1800)
  }, [onDone])

  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="flex flex-col items-center gap-3 text-center max-w-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-[2px] border border-[var(--color-line)] bg-[var(--color-surface-alt)]">
          <GitBranchIcon className="h-6 w-6 text-[var(--color-ink)]" />
        </div>
        <h2 className="font-display text-xl font-medium tracking-tight text-[var(--color-ink)]">
          Connect your GitHub account
        </h2>
        <p className="text-sm text-[var(--color-ink-tertiary)] leading-relaxed max-w-[42ch]">
          DeployTitan needs read access to your repositories and write access to create a branch.
          Only the minimum required permissions are requested.
        </p>
      </div>

      {status === 'idle' && (
        <Button
          onClick={handleConnect}
          className="flex items-center gap-2 px-8 h-10 rounded-[2px] bg-[var(--color-ink)] text-[var(--color-surface)] text-sm font-medium hover:ring-1 hover:ring-[var(--color-gold)]/30 transition-all"
        >
          <GitBranchIcon className="h-4 w-4" />
          Install DeployTitan GitHub App
        </Button>
      )}

      {status === 'pending' && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-ink-secondary)]">
          <LoaderIcon className="h-4 w-4 animate-spin text-[var(--color-gold)]" />
          Authorizing with GitHub...
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-signal-success)]">
          <CheckIcon className="h-4 w-4" />
          Connected as{' '}
          <span className="font-mono text-[var(--color-ink)]">justinekizhak</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-signal-danger)]">
          <AlertCircleIcon className="h-4 w-4" />
          Authorization failed. Check your network and try again.
          <button onClick={handleConnect} className="underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full max-w-sm rounded-[2px] border border-[var(--color-line)] bg-[var(--color-surface-alt)] p-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
          Permissions requested
        </p>
        <Separator className="bg-[var(--color-line-subtle)]" />
        {(
          [
            ['repo', 'Read your repositories'],
            ['contents:write', 'Create branches and commits'],
            ['pull_requests:write', 'Open pull requests'],
            ['metadata:read', 'Read repository metadata'],
          ] as [string, string][]
        ).map(([scope, desc]) => (
          <div key={scope} className="flex items-start gap-3 py-1">
            <span className="font-mono text-[10px] text-[var(--color-gold)] bg-[var(--color-gold-muted)] px-1.5 py-0.5 rounded-[1px] mt-0.5 shrink-0">
              {scope}
            </span>
            <span className="text-xs text-[var(--color-ink-secondary)]">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Repo Select
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const days = Math.round((now.getTime() - d.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.round(days / 30)}mo ago`
}

const LANG_COLOR: Record<string, string> = {
  TypeScript: '#3b82f6',
  Go: '#22c55e',
  Python: '#f59e0b',
  HCL: '#9e9189',
  JavaScript: '#c9a84c',
}

function StepRepoSelect({ onDone }: { onDone: (repo: Repo) => void }) {
  const [query, setQuery] = useState('')
  const [org, setOrg] = useState('acme-corp')
  const [selected, setSelected] = useState<Repo | null>(null)
  const [scanning, setScanning] = useState(false)

  const filtered = MOCK_REPOS.filter(
    r =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.fullName.toLowerCase().includes(query.toLowerCase()),
  )

  const handleSelect = (repo: Repo) => {
    setSelected(repo)
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      onDone(repo)
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-6 py-8 max-w-xl mx-auto w-full">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-medium tracking-tight text-[var(--color-ink)]">
          Select a repository
        </h2>
        <p className="text-sm text-[var(--color-ink-tertiary)]">
          Choose the repo where the DeployTitan controller will be installed.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Select value={org} onValueChange={(v) => { if (v !== null) setOrg(v) }}>
          <SelectTrigger className="w-36 h-8 text-xs rounded-[2px] border-[var(--color-line)] font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acme-corp">acme-corp</SelectItem>
            <SelectItem value="justinekizhak">justinekizhak</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-quaternary)]" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter repositories..."
            className="pl-8 h-8 text-xs rounded-[2px] border-[var(--color-line)] placeholder:text-[var(--color-ink-quaternary)]"
          />
        </div>
      </div>

      <div className="rounded-[2px] border border-[var(--color-line)] overflow-hidden">
        <ScrollArea className="h-72">
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-[var(--color-ink-quaternary)]">
              No repositories match &ldquo;{query}&rdquo;
            </div>
          )}
          {filtered.map((repo, i) => (
            <div key={repo.id}>
              <button
                onClick={() => handleSelect(repo)}
                disabled={scanning}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150 group',
                  selected?.id === repo.id
                    ? 'bg-[var(--color-gold-muted)]'
                    : 'hover:bg-[var(--color-surface-alt)]',
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-ink)] truncate">
                      {repo.name}
                    </span>
                    {repo.isPrivate && (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)] border border-[var(--color-line)] px-1 py-0.5 rounded-[1px]">
                        private
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {repo.language && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-tertiary)]">
                        <span
                          className="h-1.5 w-1.5 rounded-full inline-block"
                          style={{
                            backgroundColor: LANG_COLOR[repo.language] ?? '#9e9189',
                          }}
                        />
                        {repo.language}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[var(--color-ink-quaternary)]">
                      pushed {timeAgo(repo.pushedAt)}
                    </span>
                  </div>
                </div>

                {selected?.id === repo.id && scanning ? (
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin text-[var(--color-gold)] shrink-0" />
                ) : selected?.id === repo.id ? (
                  <CheckIcon className="h-3.5 w-3.5 text-[var(--color-gold)] shrink-0" />
                ) : (
                  <ChevronRightIcon className="h-3.5 w-3.5 text-[var(--color-line)] group-hover:text-[var(--color-ink-quaternary)] shrink-0 transition-colors" />
                )}
              </button>
              {i < filtered.length - 1 && (
                <Separator className="bg-[var(--color-line-subtle)]" />
              )}
            </div>
          ))}
        </ScrollArea>
      </div>

      {scanning && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-ink-secondary)]">Scanning repository...</span>
            <span className="font-mono text-[var(--color-ink-quaternary)]">detecting runtime</span>
          </div>
          <Progress value={65} className="h-0.5 bg-[var(--color-line)]" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: IaC Configuration — two-panel
// ---------------------------------------------------------------------------

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-[var(--color-signal-success)]/10 text-[var(--color-signal-success)] border-[var(--color-signal-success)]/20',
  medium:
    'bg-[var(--color-signal-warning)]/10 text-[var(--color-signal-warning)] border-[var(--color-signal-warning)]/20',
  low: 'bg-[var(--color-signal-danger)]/10 text-[var(--color-signal-danger)] border-[var(--color-signal-danger)]/20',
}

const DEPLOY_TARGET_LABELS: Record<DeployTarget, string> = {
  kubernetes: 'Kubernetes controller',
  'lambda-edge': 'Lambda@Edge',
  'cloud-run': 'Cloud Run',
  ecs: 'Amazon ECS',
}

const CLOUD_PROVIDER_LABELS: Record<CloudProvider, string> = {
  aws: 'Amazon Web Services',
  gcp: 'Google Cloud Platform',
  azure: 'Microsoft Azure',
  generic: 'Generic / Self-hosted',
}

/** Minimal HCL syntax highlighter — no external dependency. */
function highlightHCL(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/"([^"]*)"/g, '<span style="color:#c9a84c">"$1"</span>')
    .replace(
      /\b(terraform|required_providers|required_version|module|variable|output|source|version|default|type|description|sensitive|value)\b/g,
      '<span style="color:#60a5fa">$1</span>',
    )
    .replace(/\b(true|false|null)\b/g, '<span style="color:#f59e0b">$1</span>')
    .replace(/(#[^\n]*)/g, '<span style="color:#6b6059">$1</span>')
}

function TerraformPreview({ files }: { files: Record<string, string> }) {
  const fileNames = Object.keys(files)
  const [activeFile, setActiveFile] = useState(fileNames[0] ?? 'main.tf')
  const content = files[activeFile] ?? ''

  return (
    <div className="flex flex-col h-full border border-[var(--color-line)] rounded-[2px] overflow-hidden bg-[var(--color-ink)] font-mono">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1a1512cc] border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <FileTextIcon className="h-3 w-3 text-[var(--color-ink-quaternary)]" />
          <span className="text-[10px] font-mono text-[var(--color-ink-quaternary)] uppercase tracking-wider">
            terraform/
          </span>
        </div>
        <span className="text-[9px] font-mono text-[var(--color-gold)] uppercase tracking-widest">
          generated
        </span>
      </div>

      {/* file tabs */}
      <div className="flex border-b border-white/10 bg-[#161512]">
        {fileNames.map(name => (
          <button
            key={name}
            onClick={() => setActiveFile(name)}
            className={cn(
              'px-3 py-1.5 text-[10px] font-mono transition-colors border-r border-white/10',
              activeFile === name
                ? 'text-[var(--color-surface)] bg-[var(--color-ink)]'
                : 'text-[#8a8078] hover:text-[#c8c2b8]',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* code */}
      <ScrollArea className="flex-1">
        <div className="flex">
          {/* line numbers */}
          <div className="select-none py-4 pl-3 pr-2 text-right border-r border-white/10 shrink-0">
            {content.split('\n').map((_, i) => (
              <div key={i} className="text-[10px] leading-5 text-[#4a453e]">
                {i + 1}
              </div>
            ))}
          </div>
          {/* code body */}
          <pre
            className="flex-1 py-4 pl-4 text-[11px] leading-5 text-[#c8c2b8] overflow-x-auto whitespace-pre"
            dangerouslySetInnerHTML={{ __html: highlightHCL(content) }}
          />
        </div>
      </ScrollArea>
    </div>
  )
}

function DetectionRow({
  label,
  detected,
  confidence,
  children,
}: {
  label: string
  detected: string
  confidence: 'high' | 'medium' | 'low'
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-[var(--color-line-subtle)] last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-alt)] transition-colors"
      >
        <ChevronRightIcon
          className={cn(
            'h-3 w-3 text-[var(--color-ink-quaternary)] transition-transform duration-150 shrink-0',
            open && 'rotate-90',
          )}
        />
        <span className="text-xs text-[var(--color-ink-secondary)] flex-1 text-left">{label}</span>
        <span className="text-xs font-mono text-[var(--color-ink)]">{detected}</span>
        <span
          className={cn(
            'text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5 rounded-[1px] shrink-0',
            CONFIDENCE_BADGE[confidence],
          )}
        >
          {confidence}
        </span>
      </button>
      {open && children && (
        <div className="px-4 pb-3 pt-0">{children}</div>
      )}
    </div>
  )
}

function StepIaCConfig({
  repo,
  scan,
  onDone,
}: {
  repo: Repo
  scan: ScanResult
  onDone: (config: IaCConfig) => void
}) {
  const [config, setConfig] = useState<IaCConfig>({
    deployTarget: scan.deployTarget,
    cloudProvider: scan.cloudProvider.toLowerCase() as CloudProvider,
    region: 'us-east-1',
    clusterName: `${repo.name}-prod`,
  })

  const files = generateTerraform(config, repo.fullName)
  const update = (patch: Partial<IaCConfig>) => setConfig(c => ({ ...c, ...patch }))

  return (
    <div className="flex flex-col gap-4 py-6 w-full">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-medium tracking-tight text-[var(--color-ink)]">
          Review your infrastructure config
        </h2>
        <p className="text-sm text-[var(--color-ink-tertiary)]">
          We scanned{' '}
          <span className="font-mono text-[var(--color-ink)]">{repo.fullName}</span>. Confirm the
          target platform before we generate the Terraform module.
        </p>
      </div>

      {/* two-panel */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: '1fr 1fr', minHeight: '480px' }}
      >
        {/* LEFT panel: detection tree */}
        <div className="flex flex-col rounded-[2px] border border-[var(--color-line)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-alt)] border-b border-[var(--color-line)] shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
              Detection results
            </span>
            <button className="flex items-center gap-1 text-[10px] text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors">
              <RefreshCwIcon className="h-3 w-3" />
              Rescan
            </button>
          </div>

          <ScrollArea className="flex-1">
            {/* Application section */}
            <div className="px-4 py-2 bg-[var(--color-surface-alt)]/50">
              <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
                Application
              </span>
            </div>

            <DetectionRow
              label="Runtime"
              detected={scan.runtime}
              confidence={scan.confidence['runtime'] ?? 'medium'}
            >
              <p className="text-xs text-[var(--color-ink-tertiary)]">
                Detected via <span className="font-mono">.nvmrc</span> and{' '}
                <span className="font-mono">package.json</span> engine field.
              </p>
            </DetectionRow>

            <DetectionRow
              label="Container"
              detected={scan.containerized ? 'Dockerfile present' : 'No container'}
              confidence={scan.confidence['containerized'] ?? 'medium'}
            >
              <p className="text-xs text-[var(--color-ink-tertiary)]">
                Detected a <span className="font-mono">Dockerfile</span> at the repository root.
              </p>
            </DetectionRow>

            {/* Infrastructure section */}
            <div className="px-4 py-2 bg-[var(--color-surface-alt)]/50 border-t border-[var(--color-line-subtle)]">
              <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
                Infrastructure
              </span>
            </div>

            <DetectionRow
              label="Cloud provider"
              detected={scan.cloudProvider}
              confidence={scan.confidence['cloudProvider'] ?? 'medium'}
            >
              <div className="pt-2">
                <Select
                  value={config.cloudProvider}
                  onValueChange={v => { if (v !== null) update({ cloudProvider: v as CloudProvider }) }}
                >
                  <SelectTrigger className="h-7 text-xs rounded-[2px] border-[var(--color-line)] w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CLOUD_PROVIDER_LABELS) as [CloudProvider, string][]).map(
                      ([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </DetectionRow>

            <DetectionRow
              label="Deploy target"
              detected={DEPLOY_TARGET_LABELS[config.deployTarget]}
              confidence={scan.confidence['deployTarget'] ?? 'medium'}
            >
              <div className="pt-2">
                <Select
                  value={config.deployTarget}
                  onValueChange={v => { if (v !== null) update({ deployTarget: v as DeployTarget }) }}
                >
                  <SelectTrigger className="h-7 text-xs rounded-[2px] border-[var(--color-line)] w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DEPLOY_TARGET_LABELS) as [DeployTarget, string][]).map(
                      ([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </DetectionRow>

            {/* Settings section */}
            <div className="px-4 py-2 bg-[var(--color-surface-alt)]/50 border-t border-[var(--color-line-subtle)]">
              <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
                Settings
              </span>
            </div>

            <div className="px-4 py-3 flex flex-col gap-3">
              {config.deployTarget === 'kubernetes' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-[var(--color-ink-secondary)]">
                    Cluster name
                  </label>
                  <Input
                    value={config.clusterName}
                    onChange={e => update({ clusterName: e.target.value })}
                    className="h-7 text-xs rounded-[2px] border-[var(--color-line)] font-mono"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-[var(--color-ink-secondary)]">
                    Region
                  </label>
                  <Input
                    value={config.region}
                    onChange={e => update({ region: e.target.value })}
                    className="h-7 text-xs rounded-[2px] border-[var(--color-line)] font-mono"
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT panel: live Terraform preview */}
        <TerraformPreview files={files} />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => onDone(config)}
          className="rounded-[2px] bg-[var(--color-ink)] text-[var(--color-surface)] hover:ring-1 hover:ring-[var(--color-gold)]/30 transition-all h-9 px-6 text-sm"
        >
          Confirm and generate PR
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: PR Creation
// ---------------------------------------------------------------------------

type PRStatus = 'idle' | 'creating' | 'done' | 'error'

function StepCreatePR({ repo, config }: { repo: Repo; config: IaCConfig }) {
  const [status, setStatus] = useState<PRStatus>('idle')
  const [prUrl, setPrUrl] = useState('')

  const files = generateTerraform(config, repo.fullName)
  const fileNames = Object.keys(files)

  const handleCreate = () => {
    setStatus('creating')
    setTimeout(() => {
      setStatus('done')
      setPrUrl(`https://github.com/${repo.fullName}/pull/42`)
    }, 2000)
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-8 py-12 max-w-lg mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-[2px] bg-[var(--color-signal-success)]/10 border border-[var(--color-signal-success)]/20">
          <CheckIcon className="h-6 w-6 text-[var(--color-signal-success)]" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-medium tracking-tight text-[var(--color-ink)]">
            PR opened
          </h2>
          <p className="text-sm text-[var(--color-ink-tertiary)] leading-relaxed max-w-[42ch]">
            DeployTitan opened a pull request on{' '}
            <span className="font-mono text-[var(--color-ink)]">{repo.fullName}</span> with the
            Terraform module. Merge it to activate the controller.
          </p>
        </div>

        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-6 py-2.5 rounded-[2px] bg-[var(--color-ink)] text-[var(--color-surface)] text-sm font-medium hover:ring-1 hover:ring-[var(--color-gold)]/30 transition-all"
        >
          <GitPullRequestIcon className="h-4 w-4" />
          Review PR on GitHub
          <ExternalLinkIcon className="h-3.5 w-3.5 opacity-60" />
        </a>

        <div className="w-full rounded-[2px] border border-[var(--color-line)] divide-y divide-[var(--color-line-subtle)]">
          {(
            [
              ['Branch', 'deploytitan/setup'],
              ['Files added', fileNames.map(f => `terraform/${f}`).join(', ')],
              ['Target', DEPLOY_TARGET_LABELS[config.deployTarget]],
              ['Next step', 'Merge PR to activate controller'],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-start justify-between px-4 py-2.5 gap-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)] shrink-0 mt-0.5">
                {k}
              </span>
              <span className="text-xs text-[var(--color-ink-secondary)] text-right font-mono">
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-8 max-w-xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-medium tracking-tight text-[var(--color-ink)]">
          Your setup is ready
        </h2>
        <p className="text-sm text-[var(--color-ink-tertiary)]">
          We&apos;ll open a PR to{' '}
          <span className="font-mono text-[var(--color-ink)]">deploytitan/setup</span> on{' '}
          <span className="font-mono text-[var(--color-ink)]">{repo.fullName}</span> with the
          Terraform module. Merge it to activate the controller.
        </p>
      </div>

      {/* Files */}
      <div className="rounded-[2px] border border-[var(--color-line)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--color-surface-alt)] border-b border-[var(--color-line)]">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
            Files to be committed
          </span>
        </div>
        {fileNames.map((name, i) => (
          <div key={name}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <FileTextIcon className="h-3.5 w-3.5 text-[var(--color-ink-quaternary)] shrink-0" />
              <span className="font-mono text-xs text-[var(--color-ink-secondary)]">
                terraform/{name}
              </span>
              <Badge
                variant="outline"
                className="ml-auto text-[9px] font-mono uppercase tracking-widest rounded-[1px] border-[var(--color-signal-success)]/30 text-[var(--color-signal-success)] bg-[var(--color-signal-success)]/5"
              >
                new
              </Badge>
            </div>
            {i < fileNames.length - 1 && (
              <Separator className="bg-[var(--color-line-subtle)]" />
            )}
          </div>
        ))}
      </div>

      {/* PR metadata */}
      <div className="rounded-[2px] border border-[var(--color-line)] divide-y divide-[var(--color-line-subtle)]">
        {(
          [
            ['Branch', 'deploytitan/setup'],
            ['PR title', 'chore: add DeployTitan controller via Terraform'],
            ['Target', DEPLOY_TARGET_LABELS[config.deployTarget]],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-ink-quaternary)]">
              {k}
            </span>
            <span className="text-xs font-mono text-[var(--color-ink-secondary)]">{v}</span>
          </div>
        ))}
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-signal-danger)]">
          <AlertCircleIcon className="h-4 w-4 shrink-0" />
          Failed to create PR. Check your GitHub App permissions and try again.
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleCreate}
          disabled={status === 'creating'}
          className="flex items-center gap-2 rounded-[2px] bg-[var(--color-ink)] text-[var(--color-surface)] hover:ring-1 hover:ring-[var(--color-gold)]/30 transition-all h-9 px-6 text-sm disabled:opacity-60"
        >
          {status === 'creating' ? (
            <>
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
              Opening PR on GitHub...
            </>
          ) : (
            <>
              <GitPullRequestIcon className="h-3.5 w-3.5" />
              Create PR
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main SetupPage
// ---------------------------------------------------------------------------

export function SetupPage() {
  const [step, setStep] = useState<Step>(1)
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null)
  const [repo, setRepo] = useState<Repo | null>(null)
  const [iacConfig, setIaCConfig] = useState<IaCConfig | null>(null)

  const handleGitHubDone = useCallback(
    (user: GitHubUser) => {
      setGithubUser(user)
      setTimeout(() => setStep(2), 600)
    },
    [],
  )

  const handleRepoDone = useCallback((r: Repo) => {
    setRepo(r)
    setTimeout(() => setStep(3), 400)
  }, [])

  const handleIaCDone = useCallback((config: IaCConfig) => {
    setIaCConfig(config)
    setStep(4)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[var(--color-line)] px-8 py-4 flex items-center justify-between bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-medium text-[var(--color-ink)] tracking-tight">
            DeployTitan
          </span>
          <ChevronRightIcon className="h-3.5 w-3.5 text-[var(--color-line)]" />
          <span className="text-sm text-[var(--color-ink-tertiary)]">Setup</span>
        </div>
        <StepTrack current={step} />
      </header>

      {/* Content */}
      <main
        className={cn(
          'flex-1 w-full px-8 py-4',
          step === 3 ? '' : 'mx-auto max-w-2xl',
        )}
      >
        {step === 1 && <StepConnect onDone={handleGitHubDone} />}
        {step === 2 && <StepRepoSelect onDone={handleRepoDone} />}
        {step === 3 && repo && (
          <StepIaCConfig repo={repo} scan={MOCK_SCAN} onDone={handleIaCDone} />
        )}
        {step === 4 && repo && iacConfig && (
          <StepCreatePR repo={repo} config={iacConfig} />
        )}
      </main>
    </div>
  )
}
