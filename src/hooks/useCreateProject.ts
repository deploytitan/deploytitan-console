import { useCallback } from "react";
import { logFrontendEvent } from "@/lib/frontendTelemetry";
import { createProject as createProjectRequest } from "@/lib/console/http";

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
  const create = useCallback(
    async (args: CreateProjectArgs): Promise<CreatedProject> => {
      logFrontendEvent({
        level: "info",
        message: "project.create.started",
        context: { orgId: args.orgId, name: args.name },
      });

      const project = await createProjectRequest(args);
      return {
        id: project.id,
        publicId: project.publicId,
        name: project.name,
      };
    },
    [],
  );

  return { create };
}
