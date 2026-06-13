import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { orgId } = await context.params;
  const body = (await request.json()) as { name?: string };

  if (!body.name?.trim()) {
    return new NextResponse("Project name is required.", { status: 400 });
  }

  const project = await convexMutation("console:createProject", {
    workosOrgId: orgId,
    name: body.name.trim(),
  });

  return NextResponse.json(project);
}
