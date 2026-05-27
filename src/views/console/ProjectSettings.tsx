'use client'

/**
 * ProjectSettings page — project-level settings.
 * Route: /orgs/:orgId/projects/:projectId/settings
 *
 * Tabs:
 *   General — project ID, danger zone (delete project)
 */

import { useState } from 'react'
import { useNavigate } from '@/lib/navigation'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { useZero } from '@rocicorp/zero/react'
import { mutators } from '@deploytitan/zero-schema'
import { useOrgProject } from '../../contexts/OrgProjectContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

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

// ─── Tab: General ─────────────────────────────────────────────────────────────

function GeneralTab({
  projectName,
  projectId,
}: {
  projectName: string
  projectId: string
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const zero = useZero()
  const navigate = useNavigate()

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setDeleteInput('')
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (deleteInput.trim() !== projectName) return

    setDeleteError(null)
    setIsDeleting(true)
    try {
      const write = zero.mutate(mutators.project.delete({ id: projectId }))
      const clientResult = await write.client
      if (clientResult.type === 'error') {
        throw new Error(clientResult.error.message)
      }
      await write.server
      navigate({ to: '/overview' })
    } catch (err) {
      console.error('[ProjectSettings] project deletion failed', err)
      logFrontendEvent({ level: 'error', message: 'project.delete.failed', context: { error: err } })
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed. Try again.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-10 max-w-lg">
      {/* Project info */}
      <section>
        <SectionLabel>Project</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] text-ink-secondary mb-1">Display name</label>
            <div className="rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[13px] text-ink-secondary select-all">
              {projectName}
            </div>
            <p className="mt-1 text-[10px] text-ink-quaternary">
              Project name can be changed from the project overview.
            </p>
          </div>

          <div>
            <label className="block text-[11px] text-ink-secondary mb-1">Project ID</label>
            <div
              className="flex items-center rounded-[2px] border border-line bg-surface-alt px-3 py-2 text-[12px] text-ink-tertiary select-all"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {projectId}
            </div>
            <p className="mt-1 text-[10px] text-ink-quaternary">
              Project ID is a permanent identifier and cannot be changed.
            </p>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <SectionLabel>Danger zone</SectionLabel>
        {!showDeleteConfirm ? (
          <div className="rounded-[4px] border border-signal-danger/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-ink mb-0.5">Delete project</p>
                <p className="text-[11px] text-ink-tertiary leading-relaxed">
                  Permanently deletes all rollout history, service configurations, policies, and
                  integrations for this project. This action cannot be undone.
                </p>
              </div>
              <button
                className="shrink-0 rounded-[2px] border border-signal-danger/40 px-3 py-1.5 text-[12px] text-signal-danger transition-colors hover:bg-signal-danger/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete project
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[4px] border border-signal-danger/40 bg-signal-danger/5 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-signal-danger mb-1">
                  Confirm deletion
                </p>
                <p className="text-[11px] text-ink-tertiary leading-relaxed">
                  This will permanently delete{' '}
                  <strong className="text-ink font-medium">{projectName}</strong> and all its data.
                  To confirm, type the project name below.
                </p>
              </div>
              <button
                onClick={cancelDelete}
                className="shrink-0 p-1 rounded-[2px] text-ink-tertiary hover:text-ink transition-colors focus:outline-none"
                aria-label="Cancel deletion"
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <label
                htmlFor="delete-project-confirm"
                className="block text-[11px] text-ink-secondary mb-1"
              >
                Project name
              </label>
              <input
                id="delete-project-confirm"
                type="text"
                value={deleteInput}
                onChange={(e) => {
                  setDeleteInput(e.target.value)
                  setDeleteError(null)
                }}
                placeholder={projectName}
                className="w-full rounded-[2px] border border-signal-danger/30 bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-quaternary focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
                autoFocus
              />
            </div>

            {deleteError && (
              <p className="flex items-center gap-1.5 text-[11px] text-signal-danger">
                <AlertTriangle size={12} />
                {deleteError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteInput.trim() !== projectName || isDeleting}
                className="flex items-center gap-2 rounded-[2px] bg-signal-danger px-4 py-1.5 text-[12px] font-medium text-surface transition-colors hover:opacity-90 disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-danger/40"
              >
                {isDeleting && <Loader2 size={11} className="animate-spin" />}
                {isDeleting ? 'Deleting…' : 'Delete project'}
              </button>
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="rounded-[2px] px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:text-ink disabled:opacity-40 focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export function ProjectSettings() {
  const { orgId, projectId, projectName } = useOrgProject()

  const displayProjectName = projectName ?? 'Untitled project'
  const resolvedProjectId = projectId ?? ''

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
        <p
          className="text-[11px] text-ink-tertiary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {resolvedProjectId}
        </p>
      </div>

      {/* Tab bar + content */}
      <Tabs defaultValue="general">
        <TabsList
          variant="line"
          className="sticky top-0 z-10 bg-surface border-b border-line mb-8 w-full justify-start -mx-8 px-8 rounded-none"
        >
          <TabsTrigger
            value="general"
            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] rounded-t-[2px]"
          >
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab
            projectName={displayProjectName}
            projectId={resolvedProjectId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
