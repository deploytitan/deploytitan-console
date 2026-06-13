import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { projectId } = await context.params;
  const body = (await request.json()) as {
    repoOwner?: string;
    repoName?: string;
    defaultBranch?: string;
  };

  if (!body.repoOwner?.trim() || !body.repoName?.trim()) {
    return new NextResponse("Repository owner and name are required.", {
      status: 400,
    });
  }

  const repository = await convexMutation("console:createRepository", {
    projectPublicId: projectId,
    repoOwner: body.repoOwner.trim(),
    repoName: body.repoName.trim(),
    defaultBranch: body.defaultBranch?.trim() || undefined,
  });

  return NextResponse.json(repository);
}
