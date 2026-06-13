import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { itemId } = await context.params;
  const body = (await request.json()) as Record<string, unknown> & {
    releaseId?: string;
  };

  if (!body.releaseId || typeof body.releaseId !== "string") {
    return new NextResponse("releaseId is required.", { status: 400 });
  }

  const item = await convexMutation("console:updateReleaseItem", {
    releasePublicId: body.releaseId,
    itemId,
    title: typeof body.title === "string" ? body.title : undefined,
    details: typeof body.details === "string" ? body.details : undefined,
    kind:
      body.kind === "task" || body.kind === "risk" || body.kind === "note"
        ? body.kind
        : undefined,
    status:
      body.status === "todo" || body.status === "doing" || body.status === "done"
        ? body.status
        : undefined,
  });

  return NextResponse.json(item);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { itemId } = await context.params;
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get("releaseId");

  if (!releaseId) {
    return new NextResponse("releaseId is required.", { status: 400 });
  }

  await convexMutation("console:removeReleaseItem", {
    releasePublicId: releaseId,
    itemId,
  });

  return NextResponse.json(null);
}
