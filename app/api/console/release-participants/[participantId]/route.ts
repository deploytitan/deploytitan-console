import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexMutation } from "@/lib/console/convexServer";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ participantId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { participantId } = await context.params;
  const body = (await request.json()) as {
    releaseId?: string;
    role?: string;
    status?: "pending" | "confirmed" | "complete";
    notes?: string;
  };

  if (!body.releaseId) {
    return new NextResponse("releaseId is required.", { status: 400 });
  }

  const participant = await convexMutation("console:updateReleaseParticipant", {
    releasePublicId: body.releaseId,
    participantId,
    role: body.role?.trim() || undefined,
    status: body.status,
    notes: body.notes?.trim() || undefined,
  });

  return NextResponse.json(participant);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ participantId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { participantId } = await context.params;
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get("releaseId");

  if (!releaseId) {
    return new NextResponse("releaseId is required.", { status: 400 });
  }

  await convexMutation("console:removeReleaseParticipant", {
    releasePublicId: releaseId,
    participantId,
  });

  return NextResponse.json(null);
}
