/**
 * useCreateProject — creates a project within an org via the Zero mutator.
 *
 * Returns an async `create` function and an `isPending` flag.
 */

import { useCallback } from "react";
import { useZero } from "@rocicorp/zero/react";
import { createProjectIds, mutators } from "@deploytitan/zero-schema";
import { logFrontendEvent } from "@/lib/frontendTelemetry";
import { registerPendingMutation } from "@/store/pendingMutations";

interface CreateProjectArgs {
  orgId: string;
  name: string;
}

interface CreatedProject {
  id: string;
  publicId: string;
  name: string;
}

export function useCreateProject() {
  const zero = useZero();

  const create = useCallback(
    async (args: CreateProjectArgs): Promise<CreatedProject> => {
      const { id, publicId } = createProjectIds();
      logFrontendEvent({
        level: "info",
        message: "project.create.started",
        context: { id, orgId: args.orgId, name: args.name },
      });

      try {
        const write = zero.mutate(
          mutators.project.create({
            id,
            publicId,
            orgId: args.orgId,
            name: args.name,
          }),
        );
        await write.client;
        registerPendingMutation(write.server);
        await write.server;
        return { id, publicId, name: args.name };
      } catch (error) {
        throw error;
      }
    },
    [zero],
  );

  return { create };
}
