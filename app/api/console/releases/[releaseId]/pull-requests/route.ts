import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function POST(
  request: Request,
  context: { params: Promise<{ releaseId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { releaseId } = await context.params;
  const body = (await request.json()) as { pullRequestPublicId?: string };

  if (!body.pullRequestPublicId) {
    return new NextResponse("pullRequestPublicId is required.", { status: 400 });
  }

  await convexMutation("console:attachPullRequestToRelease", {
    releasePublicId: releaseId,
    pullRequestPublicId: body.pullRequestPublicId,
  });

  return NextResponse.json(null);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ releaseId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { releaseId } = await context.params;
  const body = (await request.json()) as { pullRequestPublicId?: string };

  if (!body.pullRequestPublicId) {
    return new NextResponse("pullRequestPublicId is required.", { status: 400 });
  }

  await convexMutation("console:detachPullRequestFromRelease", {
    releasePublicId: releaseId,
    pullRequestPublicId: body.pullRequestPublicId,
  });

  return NextResponse.json(null);
}
