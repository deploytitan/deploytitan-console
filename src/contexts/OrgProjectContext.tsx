'use client'

import { useParams } from '@/lib/navigation'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@deploytitan/zero-schema'

interface UseOrgProjectResult {
  orgId: string | null
  projectId: string | null
  orgName: string | null
  orgSlug: string | null
  projectName: string | null
  projectSlug: string | null
}

export function useOrgProject(): UseOrgProjectResult {
  const params = useParams({ strict: false }) as { orgId?: string; projectId?: string }
  const orgId = params.orgId ?? null
  const projectId = params.projectId ?? null

  const [org] = useQuery(queries.orgById({ workosOrgId: orgId ?? '__no_org__' }))
  const [project] = useQuery(queries.projectById({ id: projectId ?? '__no_project__' }))

  return {
    orgId,
    projectId,
    orgName: org?.name ?? null,
    orgSlug: org?.workosOrgId ?? null,
    projectName: project?.name ?? null,
    projectSlug: project?.id ?? null,
  }
}
