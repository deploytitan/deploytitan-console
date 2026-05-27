/**
 * useOrgList — organizations the current user belongs to, via Zero sync.
 *
 * Zero's server-side permissions automatically filter this query to orgs
 * the authenticated user is a member of. No client-side filtering needed.
 *
 * Returns a stable { orgs, isLoading } shape. The `isLoading` flag is true
 * only when Zero hasn't synced yet AND there are no cached rows to show.
 */

import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'

export interface Org {
  /** WorkOS org ID — the primary key after schema refactor. */
  workosOrgId: string
  name: string
}

interface UseOrgListResult {
  orgs: Org[]
  isLoading: boolean
}

export function useOrgList(): UseOrgListResult {
  const [rows, queryState] = useQuery(queries.allOrgs({}))

  const orgs: Org[] = rows.map((r) => ({
    workosOrgId: r.workosOrgId,
    name: r.name,
  }))

  // Only show loading when state is unknown AND there's nothing to show yet.
  // Once we have rows (e.g. from local cache), stop showing the spinner.
  const isLoading = queryState.type === 'unknown' && orgs.length === 0

  return { orgs, isLoading }
}
