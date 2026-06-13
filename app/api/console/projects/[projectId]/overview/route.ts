import { NextResponse } from "next/server";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";
import { convexQuery } from "@/lib/console/convexServer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  await syncAuthenticatedSessionToConvex();
  const { projectId } = await context.params;

  const data = await convexQuery("console:getProjectOverview", {
    projectPublicId: projectId,
  });

  return NextResponse.json(data);
}
