'use client'

import { useMemo, useState } from 'react'
import { useParams } from '@/lib/navigation'
import { useQuery } from '@rocicorp/zero/react'
import { queries, type PullRequest, type Repository, type Service } from '@deploytitan/zero-schema'
import {
  Check,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DemoBanner,
  DeployStatusBadge,
  MonoLabel,
  SectionHeader,
  timeSince,
} from '../../components/console/ConsolePrimitives'
import { DEMO_PR_RISKS } from '../../lib/demo-data'
import { isDemoMode } from '../../hooks/useDemoMode'
import {
  getGitHubInstallUrl,
  mergePullRequest,
  type MergePullRequestInput,
  type PRMergeMethod,
} from '../../lib/api'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

type MergeStatus = NonNullable<PullRequest['mergeStatus']>

interface PullRequestRow {
  id: string
  repoId: string
  repoLabel: string
  serviceName: string
  prNumber: number
  title: string
  author: string
  htmlUrl: string | null
  sourceBranch: string | null
  targetBranch: string | null
  state: string
  draft: boolean
  headSha: string
  updatedAt: number
  mergeStatus: MergeStatus
  mergeMethod: PRMergeMethod
  installationId: number | null
  lastError: string | null
  demo: boolean
}

const STATUS_FILTERS: { label: string; value: 'all' | MergeStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Checking', value: 'checking' },
  { label: 'Merging', value: 'merging' },
  { label: 'Merged', value: 'merged' },
  { label: 'Blocked', value: 'blocked' },
  { label: 'Failed', value: 'failed' },
]

function shortSha(sha: string) {
  return sha.length > 8 ? sha.slice(0, 8) : sha
}

function asFiniteNumber(value: unknown): number | null {
  const maybe = value
  return typeof maybe === 'number' && Number.isFinite(maybe) ? maybe : null
}

function buildLiveRows(
  pullRequests: PullRequest[],
  services: Service[],
  repositories: Repository[],
  projectId: string,
): PullRequestRow[] {
  const serviceById = new Map(services.map((service) => [service.id, service]))
  const repoById = new Map(repositories.map((repo) => [repo.id, repo]))

  return pullRequests
    .filter((pr) => {
      if (!pr.serviceId) return true
      return serviceById.get(pr.serviceId)?.projectId === projectId
    })
    .map((pr) => {
      const service = pr.serviceId ? serviceById.get(pr.serviceId) : undefined
      const repo = repoById.get(pr.repoId)
      const installationId =
        asFiniteNumber(pr.installationId) ?? asFiniteNumber(repo?.installationId)
      return {
        id: pr.id,
        repoId: pr.repoId,
        repoLabel: repo ? `${repo.repoOwner}/${repo.repoName}` : pr.repoId,
        serviceName: service?.serviceName ?? 'Unmapped service',
        prNumber: pr.prNumber,
        title: pr.title || `Pull request #${pr.prNumber}`,
        author: pr.authorLogin ?? 'GitHub',
        htmlUrl: pr.htmlUrl ?? null,
        sourceBranch: pr.sourceBranch ?? null,
        targetBranch: pr.targetBranch ?? repo?.defaultBranch ?? null,
        state: pr.state ?? 'open',
        draft: pr.draft ?? false,
        headSha: pr.headSha,
        updatedAt: pr.updatedAt ?? pr.createdAt ?? Date.now(),
        mergeStatus: pr.mergeStatus ?? 'pending',
        mergeMethod: (pr.mergeMethod ?? 'squash') as PRMergeMethod,
        installationId,
        lastError: pr.lastError ?? null,
        demo: false,
      }
    })
}

function buildDemoRows(): PullRequestRow[] {
  return DEMO_PR_RISKS.map((pr, index) => {
    const status: MergeStatus =
      pr.status === 'deployed' ? 'merged' : pr.status === 'blocked' ? 'blocked' : 'pending'
    return {
      id: pr.id,
      repoId: `demo-repo-${index + 1}`,
      repoLabel: `acme/${pr.service}`,
      serviceName: pr.service,
      prNumber: pr.prNumber,
      title: pr.prTitle,
      author: pr.prAuthor,
      htmlUrl: null,
      sourceBranch: `feature/pr-${pr.prNumber}`,
      targetBranch: 'main',
      state: status === 'merged' ? 'closed' : 'open',
      draft: false,
      headSha: `demo${String(pr.prNumber).padStart(36, '0')}`,
      updatedAt: pr.analyzedAt,
      mergeStatus: status,
      mergeMethod: 'squash',
      installationId: 100000 + index,
      lastError: status === 'blocked' ? 'Risk policy requires manual review.' : null,
      demo: true,
    }
  })
}

export function PullRequestsPage() {
  const { orgId, projectId } = useParams({
    from: '/_protected/_console/orgs/$orgId/projects/$projectId/pull-requests',
  })
  const [pullRequests] = useQuery(queries.allPullRequests({}))
  const [repositories] = useQuery(queries.allRepositories({}))
  const [services] = useQuery(queries.allServices({}))

  const [filter, setFilter] = useState<'all' | MergeStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set())
  const [installing, setInstalling] = useState(false)
  const [localStatus, setLocalStatus] = useState<Record<string, MergeStatus>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const liveRows = useMemo(
    () =>
      buildLiveRows(
        pullRequests ?? [],
        services ?? [],
        repositories ?? [],
        projectId,
      ),
    [pullRequests, services, repositories, projectId],
  )
  const demo = isDemoMode(services ?? []) && liveRows.length === 0
  const rows = useMemo(() => (demo ? buildDemoRows() : liveRows), [demo, liveRows])
  const displayRows = rows.map((row) => ({
    ...row,
    mergeStatus: localStatus[row.id] ?? row.mergeStatus,
  }))
  const filteredRows =
    filter === 'all' ? displayRows : displayRows.filter((row) => row.mergeStatus === filter)
  const selectableRows = filteredRows.filter((row) => canQueueMerge(row).ok)
  const selectedCount = filteredRows.filter((row) => selectedIds.has(row.id)).length
  const allSelectableSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedIds.has(row.id))

  function toggleSelected(rowId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allSelectableSelected) {
        selectableRows.forEach((row) => next.delete(row.id))
      } else {
        selectableRows.forEach((row) => next.add(row.id))
      }
      return next
    })
  }

  async function queueMerge(row: PullRequestRow) {
    const mergeable = canQueueMerge(row)
    if (!mergeable.ok) {
      setNotice(mergeable.reason)
      return
    }

    setBusyIds((current) => new Set(current).add(row.id))
    setNotice(null)
    try {
      if (row.demo) {
        await new Promise((resolve) => setTimeout(resolve, 450))
      } else {
        const installationId = row.installationId
        if (installationId === null) {
          throw new Error('GitHub App installation ID has not been synced for this repository yet.')
        }
        const payload: MergePullRequestInput = {
          repoId: row.repoId,
          pullNumber: row.prNumber,
          headSha: row.headSha,
          installationId,
          mergeMethod: row.mergeMethod,
        }
        await mergePullRequest(payload)
      }
      setLocalStatus((current) => ({ ...current, [row.id]: 'pending' }))
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(row.id)
        return next
      })
      setNotice(`PR #${row.prNumber} queued for ${row.mergeMethod} merge.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[PullRequests] queue merge failed', error)
      logFrontendEvent({ level: 'error', message: 'pr.merge.queue.failed', context: { error, prNumber: row.prNumber } })
      setLocalStatus((current) => ({ ...current, [row.id]: 'failed' }))
      setNotice(`Could not queue PR #${row.prNumber}: ${message}`)
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(row.id)
        return next
      })
    }
  }

  async function queueSelected() {
    const selected = displayRows.filter((row) => selectedIds.has(row.id) && canQueueMerge(row).ok)
    if (selected.length === 0) {
      setNotice('Select at least one mergeable PR.')
      return
    }

    for (const row of selected) {
      await queueMerge(row)
    }
    setNotice(`${selected.length} PR${selected.length === 1 ? '' : 's'} queued for merge.`)
  }

  async function startGitHubInstall() {
    setInstalling(true)
    setNotice(null)
    try {
      const returnTo = typeof window === 'undefined' ? undefined : window.location.href
      const { installUrl } = await getGitHubInstallUrl({
        orgId,
        projectId,
        ...(returnTo !== undefined && { returnTo }),
      })
      window.location.href = installUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[PullRequests] GitHub App install URL failed', error)
      logFrontendEvent({ level: 'error', message: 'github.install.url.failed', context: { error } })
      setNotice(`Could not start GitHub App install: ${message}`)
      setInstalling(false)
    }
  }

  return (
    <div className="min-h-full">
      {demo && <DemoBanner />}

      <div className="px-4 py-8 animate-fade-up sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 xl:flex-row">
          <div className="flex items-start gap-3">
            <GitPullRequest
              size={18}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0 text-ink-tertiary"
            />
            <div>
              <h1
                className="mb-1 text-[22px] font-medium leading-none tracking-tight text-ink"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
              >
                Pull Requests
              </h1>
              <p className="text-[12px] text-ink-tertiary">
                Review open PRs and queue guarded GitHub merges through DeployTitan.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={startGitHubInstall} disabled={installing}>
              {installing ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
              Install GitHub App
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalStatus({})
                setNotice('Status view refreshed from Zero.')
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
            <Button size="sm" onClick={queueSelected} disabled={selectedCount === 0}>
              <GitMerge size={13} />
              Merge selected
            </Button>
          </div>
        </div>

        <div className="mb-6 overflow-x-auto border-b border-line">
          <div className="flex min-w-max items-center gap-1">
            {STATUS_FILTERS.map((item) => {
              const count =
                item.value === 'all'
                  ? displayRows.length
                  : displayRows.filter((row) => row.mergeStatus === item.value).length
              return (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={[
                    'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] transition-colors duration-150 -mb-px',
                    filter === item.value
                      ? 'border-ink text-ink font-medium'
                      : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
                  ].join(' ')}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {item.label}
                  <span
                    className={[
                      'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[9px] leading-none',
                      filter === item.value ? 'bg-ink text-surface' : 'bg-line text-ink-quaternary',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-[4px] border border-line bg-surface-alt px-4 py-3 text-[12px] text-ink-secondary">
            {notice}
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <SectionHeader right={`${selectedCount} selected`}>Merge queue</SectionHeader>
          <button
            type="button"
            onClick={toggleAllVisible}
            disabled={selectableRows.length === 0}
            className="mb-5 text-[10px] text-ink-tertiary transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {allSelectableSelected ? 'Clear visible' : 'Select mergeable'}
          </button>
        </div>

        {filteredRows.length === 0 ? (
          <EmptyState demo={demo} />
        ) : (
          <div className="overflow-x-auto rounded-[4px] border border-line">
            <div className="min-w-[920px]">
            <div
              className="grid gap-3 border-b border-line bg-surface-alt px-4 py-2"
              style={{ gridTemplateColumns: '28px 1fr 145px 96px 110px 126px' }}
            >
              {['', 'PR', 'SERVICE', 'STATUS', 'UPDATED', 'ACTION'].map((label) => (
                <span
                  key={label}
                  className="text-[9px] font-medium uppercase tracking-[0.1em] text-ink-quaternary"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {label}
                </span>
              ))}
            </div>

            <ul className="divide-y divide-line">
              {filteredRows.map((row) => (
                <PullRequestListRow
                  key={row.id}
                  row={row}
                  selected={selectedIds.has(row.id)}
                  busy={busyIds.has(row.id)}
                  onToggleSelected={() => toggleSelected(row.id)}
                  onQueueMerge={() => queueMerge(row)}
                />
              ))}
            </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function canQueueMerge(row: PullRequestRow): { ok: true } | { ok: false; reason: string } {
  if (row.mergeStatus === 'merged') return { ok: false, reason: 'This PR is already merged.' }
  if (row.state !== 'open') return { ok: false, reason: 'This PR is not open.' }
  if (row.draft) return { ok: false, reason: 'Draft PRs cannot be merged yet.' }
  if (row.mergeStatus === 'checking' || row.mergeStatus === 'merging') {
    return { ok: false, reason: 'This PR already has an active merge job.' }
  }
  if (row.mergeStatus === 'blocked') return { ok: false, reason: row.lastError ?? 'Merge is blocked.' }
  if (!row.installationId) {
    return {
      ok: false,
      reason: 'GitHub App installation ID has not been synced for this repository yet.',
    }
  }
  return { ok: true }
}

function PullRequestListRow({
  row,
  selected,
  busy,
  onToggleSelected,
  onQueueMerge,
}: {
  row: PullRequestRow
  selected: boolean
  busy: boolean
  onToggleSelected: () => void
  onQueueMerge: () => void
}) {
  const mergeable = canQueueMerge(row)

  return (
    <li
      className="grid items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-alt/60"
      style={{ gridTemplateColumns: '28px 1fr 145px 96px 110px 126px' }}
    >
      <label className="flex h-5 w-5 items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          disabled={!mergeable.ok}
          className="h-3.5 w-3.5 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Select PR #${row.prNumber}`}
        />
      </label>

      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 items-center gap-2">
          <span
            className="shrink-0 text-[11px] text-ink-tertiary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            #{row.prNumber}
          </span>
          <span className="truncate text-[13px] font-medium text-ink">{row.title}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[10px] text-ink-quaternary">
          <MonoLabel dim>{row.repoLabel}</MonoLabel>
          <span aria-hidden="true">/</span>
          {row.sourceBranch && row.targetBranch && (
            <>
              <MonoLabel dim>
                {row.sourceBranch} to {row.targetBranch}
              </MonoLabel>
              <span aria-hidden="true">/</span>
            </>
          )}
          <MonoLabel dim>{shortSha(row.headSha)}</MonoLabel>
          <span aria-hidden="true">/</span>
          <span className="truncate">opened by {row.author}</span>
        </div>
        {!mergeable.ok && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-quaternary">
            <ShieldAlert size={11} />
            <span className="truncate">{mergeable.reason}</span>
          </div>
        )}
      </div>

      <span className="truncate text-[11px] text-ink-secondary">{row.serviceName}</span>
      <DeployStatusBadge status={row.mergeStatus} />
      <span
        className="text-[10px] text-ink-quaternary"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        {timeSince(row.updatedAt)}
      </span>
      <Button size="sm" variant="outline" onClick={onQueueMerge} disabled={!mergeable.ok || busy}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />}
        Merge
      </Button>
    </li>
  )
}

function EmptyState({ demo }: { demo: boolean }) {
  return (
    <div className="rounded-[4px] border border-dashed border-line px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-[4px] border border-line bg-surface-alt text-ink-tertiary">
        <Check size={16} />
      </div>
      <p className="text-[13px] font-medium text-ink">No pull requests match this view.</p>
      <p className="mt-1 text-[12px] text-ink-tertiary">
        {demo
          ? 'Demo PRs are hidden by the current filter.'
          : 'Install and sync the DeployTitan GitHub App to populate this queue.'}
      </p>
    </div>
  )
}
