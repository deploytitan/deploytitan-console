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
    repositoryPublicId?: string;
    number?: number;
    title?: string;
    url?: string;
    status?: string;
    authorName?: string;
    baseBranch?: string;
    headBranch?: string;
  };

  if (!body.title?.trim()) {
    return new NextResponse("Pull request title is required.", { status: 400 });
  }

  const pullRequest = await convexMutation("console:createPullRequest", {
    projectPublicId: projectId,
    repositoryPublicId: body.repositoryPublicId || undefined,
    number: body.number,
    title: body.title.trim(),
    url: body.url?.trim() || undefined,
    status: body.status?.trim() || undefined,
    authorName: body.authorName?.trim() || undefined,
    baseBranch: body.baseBranch?.trim() || undefined,
    headBranch: body.headBranch?.trim() || undefined,
  });

  return NextResponse.json(pullRequest);
}
