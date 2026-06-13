import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function POST(
  request: Request,
  context: { params: Promise<{ releaseId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { releaseId } = await context.params;
  const body = (await request.json()) as {
    blockingPullRequestPublicId?: string;
    blockedPullRequestPublicId?: string;
  };

  if (!body.blockingPullRequestPublicId || !body.blockedPullRequestPublicId) {
    return new NextResponse("Both dependency pull requests are required.", {
      status: 400,
    });
  }

  await convexMutation("console:addReleaseDependency", {
    releasePublicId: releaseId,
    blockingPullRequestPublicId: body.blockingPullRequestPublicId,
    blockedPullRequestPublicId: body.blockedPullRequestPublicId,
  });

  return NextResponse.json(null);
}
