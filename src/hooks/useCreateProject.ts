import { useCallback } from "react";
import { useMutation } from "convex/react";
import { logFrontendEvent } from "@/lib/frontendTelemetry";
import { api } from "@convex/_generated/api";

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
  const createProject = useMutation(api.console.createProject);

  const create = useCallback(
    async (args: CreateProjectArgs): Promise<CreatedProject> => {
      logFrontendEvent({
        level: "info",
        message: "project.create.started",
        context: { orgId: args.orgId, name: args.name },
      });

      const project = await createProject({
        workosOrgId: args.orgId,
        name: args.name,
      });
      return {
        id: project.id,
        publicId: project.publicId,
        name: project.name,
      };
    },
    [createProject],
  );

  return { create };
}
