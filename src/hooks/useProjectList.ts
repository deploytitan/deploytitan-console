/**
 * useProjectList — projects belonging to a specific org, via Zero sync.
 *
 * When orgId is null (no org selected), returns an empty list immediately
 * without querying. Zero's `useQuery` must always be called (hooks rules),
 * so we use a sentinel `where` clause (`orgId = ''`) that will never match
 * real rows, then override the result to `[]` when orgId is null.
 *
 * Returns a stable { projects, isLoading } shape.
 *
 * MOCK MODE: when VITE_MOCK_DATA=true (or Zero returns no rows), falls back
 * to a set of hard-coded demo projects so the UI remains navigable without
 * a live backend.
 */

import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'

export interface Project {
  id: string
  name: string
}

interface UseProjectListResult {
  projects: Project[]
  isLoading: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectList(orgId: string | null): UseProjectListResult {
  const [rows, queryState] = useQuery(queries.projectsByOrgId({ orgId: orgId ?? '' }))

  if (!orgId) {
    return { projects: [], isLoading: false }
  }

  const projects: Project[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
  }))

  // Only show loading when state is unknown AND there's nothing cached yet.
  const isLoading = queryState.type === 'unknown' && projects.length === 0

  return { projects, isLoading }
}
