/**
 * useCreateProject — creates a project within an org via the Zero mutator.
 *
 * Returns an async `create` function and an `isPending` flag.
 */

import { useCallback, useState } from "react";
import { useZero, useConnectionState } from "@rocicorp/zero/react";
import { mutators } from "@deploytitan/zero-schema";
import { createPrefixedId } from "../lib/prefixedIds";
import { logFrontendEvent } from "../lib/frontendTelemetry";
import { registerPendingMutation } from "@/store/pendingMutations";

interface CreateProjectArgs {
  orgId: string;
  name: string;
}

interface CreatedProject {
  id: string;
  name: string;
}

export function useCreateProject() {
  const zero = useZero();
  const connectionState = useConnectionState();

  const create = useCallback(
    async (args: CreateProjectArgs): Promise<CreatedProject> => {
      const id = createPrefixedId("prj");
      logFrontendEvent({
        level: "info",
        message: "project.create.started",
        context: { id, orgId: args.orgId, name: args.name },
      });

      try {
        const write = zero.mutate(
          mutators.project.create({ id, orgId: args.orgId, name: args.name }),
        );
        await write.client;
        registerPendingMutation(write.server);
        await write.server;
        return { id, name: args.name };
      } catch (error) {
        throw error;
      }
    },
    [zero, connectionState],
  );

  return { create };
}
