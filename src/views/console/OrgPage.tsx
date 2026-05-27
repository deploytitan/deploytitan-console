'use client'

/**
 * OrgPage — organization overview page.
 * Route: /orgs/:orgId
 *
 * Shows org details, a list of projects (each linking to the project detail
 * page), and an inline form to create a new project.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from '@/lib/navigation'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'
import { ChevronRight, Loader2, Plus, Settings, UserPlus } from 'lucide-react'
import { DEV_BYPASS_AUTH } from '../../env'
import { useCreateProject } from '../../hooks/useCreateProject'
import { logFrontendEvent } from '../../lib/frontendTelemetry'

export function OrgPage() {
  const { orgId } = useParams({ from: '/_protected/_console/orgs/$orgId' })

  const [org, orgResult] = useQuery(queries.orgById({ workosOrgId: orgId ?? '' }))

  const [projectRows] = useQuery(queries.projectsByOrgId({ orgId: org?.workosOrgId ?? '__none__' }))

  if (org === undefined) {
    if (DEV_BYPASS_AUTH) {
      // Zero never resolves in dev-bypass mode — synthesise a demo org from the URL slug
      const demoOrgName = orgId
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      const demoProjects: ProjectRow[] = [
        { id: 'demo-project-1', name: 'API Gateway' },
        { id: 'demo-project-2', name: 'Frontend' },
      ]
      return (
        <div className="px-8 py-10">
          <OrgHeader name={demoOrgName} id={orgId} />
          <OrgStatStrip orgId="demo-org" projectCount={demoProjects.length} />
          <ProjectsSection orgId="demo-org" projects={demoProjects} />
        </div>
      )
    }

    // Still syncing — show loading state
    if (orgResult.type === 'unknown') {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="font-mono text-[11px] tracking-wider text-ink-tertiary uppercase">
            Loading…
          </span>
        </div>
      )
    }

    // Sync complete but no matching org — this orgId doesn't exist
    return <Navigate to="/" />
  }

  if (!org) {
    return <Navigate to="/" />
  }

  const projects = [...projectRows].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="px-8 py-10">
      <OrgHeader name={org.name} id={org.workosOrgId} />
      <OrgStatStrip orgId={org.workosOrgId} projectCount={projects.length} />
      <ProjectsSection orgId={org.workosOrgId} projects={projects} />
    </div>
  )
}

// ─── Org header ───────────────────────────────────────────────────────────────

function OrgHeader({ name, id }: { name: string; id: string }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight text-ink mb-2"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.018em' }}
        >
          {name}
        </h1>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            Org ID
          </span>
          <span
            className="text-[10px] text-ink-quaternary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            ·
          </span>
          <span
            className="text-[11px] text-ink-tertiary tracking-wider"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {id}
          </span>
        </div>
      </div>
      <Link
        to="/orgs/$orgId/settings"
        params={{ orgId: id }}
        search={{ tab: 'general' }}
        className="inline-flex items-center gap-1.5 rounded-[2px] border border-line px-3 py-1.5 text-[12px] text-ink-secondary transition-colors hover:border-primary/30 hover:text-ink hover:bg-primary-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 shrink-0"
        style={{ fontFamily: 'Instrument Sans, system-ui, sans-serif' }}
      >
        <Settings size={13} strokeWidth={1.75} />
        Settings
      </Link>
    </div>
  )
}

// ─── Org stat strip ───────────────────────────────────────────────────────────
// Shows project count and invite action. Compact horizontal row; no cards.

function OrgStatStrip({ orgId, projectCount }: { orgId: string; projectCount: number }) {
  return (
    <div className="mb-8 flex items-center gap-5 border-b border-line pb-5">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.08em] text-ink-quaternary"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Projects
        </span>
        <span
          className="text-[13px] font-medium text-ink tabular-nums"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {projectCount}
        </span>
      </div>

      <span className="text-ink-quaternary text-[10px]">·</span>

      <Link
        to="/orgs/$orgId/settings"
        params={{ orgId }}
        search={{ tab: 'members' }}
        className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-secondary
                   hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1
                   focus-visible:ring-primary/30 rounded-[2px]"
      >
        <UserPlus size={12} strokeWidth={2} />
        Manage team
      </Link>
    </div>
  )
}

interface ProjectRow {
  id: string
  name: string
}

function ProjectsSection({ orgId, projects }: { orgId: string; projects: ProjectRow[] }) {
  const [showForm, setShowForm] = useState(projects.length === 0)
  const navigate = useNavigate()

  // Auto-open form when transitioning from 0 → something only once
  useEffect(() => {
    if (projects.length === 0) setShowForm(true)
  }, [projects.length])

  const handleCreated = (project: { id: string; name: string }) => {
    setShowForm(false)
    navigate({
      to: '/orgs/$orgId/projects/$projectId/overview',
      params: { orgId, projectId: project.id },
    })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-[11px] font-semibold text-ink uppercase tracking-[0.08em]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Projects
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-[2px] border border-line px-2.5 py-1 text-[11px] text-ink-tertiary transition-colors hover:border-primary/30 hover:text-ink hover:bg-primary-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <Plus size={11} strokeWidth={2} />
            New project
          </button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && (
        <CreateProjectForm
          orgId={orgId}
          onCancel={() => setShowForm(false)}
          onCreated={handleCreated}
          canCancel={projects.length > 0}
        />
      )}

      {/* Project list */}
      {projects.length === 0 && !showForm ? (
        <ProjectEmptyState onNew={() => setShowForm(true)} />
      ) : projects.length > 0 ? (
        <ul className="mt-3">
          {projects.map((project, i) => (
            <li key={project.id}>
              <Link
                to="/orgs/$orgId/projects/$projectId/overview"
                params={{ orgId, projectId: project.id }}
                className={[
                  'group flex items-center justify-between px-4 py-4 border border-line bg-surface',
                  'transition-colors hover:bg-surface-alt hover:border-primary/20',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
                  i === 0 ? 'rounded-t-[2px]' : '',
                  i === projects.length - 1 ? 'rounded-b-[2px]' : 'border-b-0',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink leading-none mb-1.5">
                    {project.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] uppercase tracking-[0.08em] text-ink-quaternary leading-none"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      ID
                    </span>
                    <span
                      className="text-[9px] text-ink-quaternary leading-none"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      ·
                    </span>
                    <span
                      className="text-[10px] text-ink-tertiary tracking-wider leading-none"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {project.id}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-ink-quaternary transition-colors group-hover:text-ink-tertiary ml-4"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function CreateProjectForm({
  orgId,
  onCancel,
  onCreated,
  canCancel,
}: {
  orgId: string
  onCancel: () => void
  onCreated: (project: { id: string; name: string }) => void
  canCancel: boolean
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { create, isPending, connectionState } = useCreateProject()
  const nameRef = useRef<HTMLInputElement>(null)
  const isConnected = connectionState.name === 'connected'

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleNameChange = (v: string) => {
    setName(v)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Project name is required.')
      return
    }

    try {
      const project = await create({ orgId, name: trimmedName })
      onCreated(project)
    } catch (err) {
      console.error('[OrgPage] project creation failed', err)
      logFrontendEvent({ level: 'error', message: 'project.create.failed', context: { error: err } })
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded-[2px] border border-line bg-surface-alt p-4"
      noValidate
    >
      <p
        className="mb-4 text-[10px] uppercase tracking-[0.08em] text-ink-tertiary"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        New project
      </p>

      <div className="space-y-3">
        <div>
          <label htmlFor="project-name" className="block text-[11px] text-ink-secondary mb-1">
            Project name
          </label>
          <input
            ref={nameRef}
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Project"
            disabled={isPending || !isConnected}
            className={[
              'w-full rounded-[2px] border bg-surface px-3 py-2 text-[13px] text-ink',
              'placeholder:text-ink-quaternary',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/40',
              'disabled:opacity-50',
              error ? 'border-signal-danger/60' : 'border-line',
            ].join(' ')}
          />
        </div>

        {error && <p className="text-[11px] text-signal-danger">{error}</p>}
        {!isConnected && (
          <p className="text-[11px] text-signal-warning" role="alert">
            {connectionState.name === 'connecting'
              ? 'Connecting to sync server…'
              : 'Not connected to sync server. Cannot create project.'}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !name.trim() || !isConnected}
          className="flex items-center gap-2 rounded-[2px] bg-ink px-4 py-2 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        >
          {isPending && <Loader2 size={11} className="animate-spin" />}
          {isPending ? 'Creating…' : 'Create project'}
        </button>

        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-[2px] px-3 py-2 text-[12px] text-ink-tertiary transition-colors hover:text-ink disabled:opacity-40 focus:outline-none"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function ProjectEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[2px] border border-dashed border-line px-6 py-8">
      <div>
        <p className="text-[13px] font-medium text-ink mb-1">No projects yet.</p>
        <p className="text-[11px] text-ink-tertiary max-w-sm leading-relaxed">
          Projects group your services and deployments. Create one to start connecting services.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 rounded-[2px] bg-ink px-3 py-1.5 text-[12px] font-medium text-surface transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        <Plus size={11} strokeWidth={2} />
        Create project
      </button>
    </div>
  )
}
