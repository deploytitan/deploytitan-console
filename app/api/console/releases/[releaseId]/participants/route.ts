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
    userId?: string;
    name?: string;
    email?: string;
    role?: string;
    notes?: string;
  };

  if (!body.name?.trim() || !body.role?.trim()) {
    return new NextResponse("Participant name and role are required.", {
      status: 400,
    });
  }

  const participant = await convexMutation("console:addReleaseParticipant", {
    releasePublicId: releaseId,
    userId: body.userId?.trim() || undefined,
    name: body.name.trim(),
    email: body.email?.trim() || undefined,
    role: body.role.trim(),
    notes: body.notes?.trim() || undefined,
  });

  return NextResponse.json(participant);
}
