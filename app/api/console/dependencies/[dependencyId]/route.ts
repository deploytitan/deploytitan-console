import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ dependencyId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { dependencyId } = await context.params;
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get("releaseId");

  if (!releaseId) {
    return new NextResponse("releaseId is required.", { status: 400 });
  }

  await convexMutation("console:removeReleaseDependency", {
    releasePublicId: releaseId,
    dependencyId,
  });

  return NextResponse.json(null);
}
