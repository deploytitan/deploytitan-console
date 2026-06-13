import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation, convexQuery } from "@/lib/console/convexServer";

export async function GET(
  request: Request,
  context: { params: Promise<{ releaseId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { releaseId } = await context.params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new NextResponse("projectId is required.", { status: 400 });
  }

  const data = await convexQuery("console:getReleaseDetail", {
    projectPublicId: projectId,
    releasePublicId: releaseId,
  });

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ releaseId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { releaseId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const release = await convexMutation("console:updateRelease", {
    releasePublicId: releaseId,
    ...body,
  });

  return NextResponse.json(release);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ releaseId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { releaseId } = await context.params;
  await convexMutation("console:deleteRelease", { releasePublicId: releaseId });
  return NextResponse.json(null);
}
