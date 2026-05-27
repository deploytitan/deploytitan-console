/**
 * useCreateProject — creates a project within an org via the Zero mutator.
 *
 * Returns an async `create` function and an `isPending` flag.
 */

import { useCallback, useState } from 'react'
import { useZero, useConnectionState } from '@rocicorp/zero/react'
import { mutators } from '@deploytitan/zero-schema'
import { createPrefixedId } from '../lib/prefixedIds'
import { logFrontendEvent } from '../lib/frontendTelemetry'
import { registerPendingMutation } from '../store/pendingMutations'

interface CreateProjectArgs {
  orgId: string
  name: string
}

interface CreatedProject {
  id: string
  name: string
}

function formatZeroMutationError(error: {
  type: 'app' | 'zero'
  message: string
}): string {
  return error.type === 'app' ? error.message : `Sync failed: ${error.message}`
}

export function useCreateProject() {
  const zero = useZero()
  const connectionState = useConnectionState()
  const [isPending, setIsPending] = useState(false)

  const create = useCallback(
    async (args: CreateProjectArgs): Promise<CreatedProject> => {
      if (connectionState.name !== 'connected') {
        throw new Error('Not connected to the sync server. Please wait and try again.')
      }

      const id = createPrefixedId('prj')
      setIsPending(true)
      logFrontendEvent({
        level: 'info',
        message: 'project.create.started',
        context: { id, orgId: args.orgId, name: args.name },
      })

      try {
        const write = zero.mutate(
          mutators.project.create({ id, orgId: args.orgId, name: args.name }),
        )

        const clientResult = await write.client
        if (clientResult.type === 'error') {
          logFrontendEvent({
            level: 'error',
            message: 'project.create.client_failed',
            context: { id, orgId: args.orgId, name: args.name, error: clientResult.error },
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
            message: 'project.create.server_failed',
            context: { id, orgId: args.orgId, name: args.name, error: serverResult.error },
          })
          throw new Error(formatZeroMutationError(serverResult.error))
        }

        logFrontendEvent({
          level: 'info',
          message: 'project.create.succeeded',
          context: { id, orgId: args.orgId, name: args.name },
        })
        return { id, name: args.name }
      } catch (error) {
        logFrontendEvent({
          level: 'error',
          message: 'project.create.failed',
          context: { id, orgId: args.orgId, name: args.name, error },
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
