/**
 * useCreateOrganization — creates an organization via the Zero mutator.
 *
 * Flow:
 *  1. Call POST /orgs to create the WorkOS org and get back a workosOrgId.
 *  2. Pass workosOrgId to the Zero mutator so the local DB row is inserted
 *     with workosOrgId as the primary key.
 *
 * Uses optimistic writes: the new org appears in local queries immediately,
 * then Zero syncs the authoritative result from the server in the background.
 *
 * The server-side mutator also inserts the creator as an owner member
 * (via the organization.create mutator in zero-schema). The client side
 * writes the org row optimistically; membership syncs from the server.
 *
 * Returns an async `create` function, an `isPending` flag, and the current
 * `connectionState` so callers can gate the UI on connectivity.
 */

import { useCallback, useState } from 'react'
import { useZero, useConnectionState } from '@rocicorp/zero/react'
import { mutators } from '@deploytitan/zero-schema'
import { logFrontendEvent } from '../lib/frontendTelemetry'
import { registerPendingMutation } from '../store/pendingMutations'
import { apiRequest } from '../lib/api'

interface CreateOrgArgs {
  name: string
}

interface CreatedOrg {
  workosOrgId: string
  name: string
}

interface OrgCreateApiResponse {
  workosOrgId: string
}

function formatZeroMutationError(error: {
  type: 'app' | 'zero'
  message: string
}): string {
  return error.type === 'app' ? error.message : `Sync failed: ${error.message}`
}

async function fetchWorkosOrgId(name: string): Promise<string> {
  const res = await apiRequest<OrgCreateApiResponse>('/orgs', {
    method: 'POST',
    json: { name },
  })
  return res.workosOrgId
}

export function useCreateOrganization() {
  const zero = useZero()
  const connectionState = useConnectionState()
  const [isPending, setIsPending] = useState(false)

  const create = useCallback(
    async (args: CreateOrgArgs): Promise<CreatedOrg> => {
      if (connectionState.name !== 'connected') {
        throw new Error('Not connected to the sync server. Please wait and try again.')
      }

      setIsPending(true)
      logFrontendEvent({
        level: 'info',
        message: 'organization.create.started',
        context: { name: args.name },
      })

      try {
        // 1. Create WorkOS org first — workosOrgId is the PK for the local row.
        const workosOrgId = await fetchWorkosOrgId(args.name)

        // 2. Write local org row via Zero mutator.
        const write = zero.mutate(
          mutators.organization.create({ workosOrgId, name: args.name }),
        )

        // Wait for both the optimistic client write and the authoritative
        // server acknowledgement. Otherwise the UI can navigate into a locally
        // created org even when the upstream push later fails.
        const clientResult = await write.client
        if (clientResult.type === 'error') {
          logFrontendEvent({
            level: 'error',
            message: 'organization.create.client_failed',
            context: { workosOrgId, name: args.name, error: clientResult.error },
          })
          throw new Error(formatZeroMutationError(clientResult.error))
        }

        // Track the server ack so the beforeunload guard can warn if the user
        // tries to close the tab before the mutation is confirmed.
        registerPendingMutation(write.server)

        const serverResult = await write.server
        if (serverResult.type === 'error') {
          logFrontendEvent({
            level: 'error',
            message: 'organization.create.server_failed',
            context: { workosOrgId, name: args.name, error: serverResult.error },
          })
          throw new Error(formatZeroMutationError(serverResult.error))
        }

        logFrontendEvent({
          level: 'info',
          message: 'organization.create.succeeded',
          context: { workosOrgId, name: args.name },
        })
        return { workosOrgId, name: args.name }
      } catch (error) {
        logFrontendEvent({
          level: 'error',
          message: 'organization.create.failed',
          context: { name: args.name, error },
        })
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [zero, connectionState],
  )

  return { create, isPending, connectionState }
}
