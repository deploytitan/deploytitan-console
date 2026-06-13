import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation, convexQuery } from "@/lib/console/convexServer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { projectId } = await context.params;

  const data = await convexQuery("console:getProjectReleases", {
    projectPublicId: projectId,
  });

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { projectId } = await context.params;
  const body = (await request.json()) as { name?: string; description?: string };

  if (!body.name?.trim()) {
    return new NextResponse("Release name is required.", { status: 400 });
  }

  const release = await convexMutation("console:createRelease", {
    projectPublicId: projectId,
    name: body.name.trim(),
    description: body.description?.trim() || undefined,
  });

  return NextResponse.json(release);
}
