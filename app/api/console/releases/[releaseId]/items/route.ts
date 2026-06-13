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
    title?: string;
    details?: string;
    kind?: "task" | "risk" | "note";
  };

  if (!body.title?.trim()) {
    return new NextResponse("Item title is required.", { status: 400 });
  }

  const item = await convexMutation("console:addReleaseItem", {
    releasePublicId: releaseId,
    title: body.title.trim(),
    details: body.details?.trim() || undefined,
    kind: body.kind,
  });

  return NextResponse.json(item);
}
